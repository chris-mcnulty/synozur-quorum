/**
 * Lightweight Model Context Protocol (MCP) server.
 *
 * Implements the JSON-RPC 2.0 surface defined by the MCP specification
 * (2024-11-05 / 2025-06-18 compatible — initialize, tools/list, tools/call,
 * resources/list, resources/read, prompts/list, prompts/get, ping).
 *
 * Two transports are exposed:
 *   • Streamable HTTP (POST /mcp) — modern transport used by Microsoft
 *     Copilot Studio and Anthropic's reference clients. JSON-RPC requests
 *     are POSTed and responded to in-line; long-running calls may upgrade
 *     to SSE.
 *   • Legacy SSE (GET /mcp/sse + POST /mcp/messages) — used by Claude
 *     Desktop and Cursor. Messages are streamed as SSE; the client posts
 *     replies to a session-scoped messages URL.
 */
import type { Request, Response, RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";

export const PROTOCOL_VERSION = "2025-06-18";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpAuthContext {
  tenantId: string;
  userId: string;
  scopes: string[];
  source: "api_key" | "oauth" | "anonymous";
  keyId?: string;
}

export interface McpToolDef<I extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: I;
  scopes: string[];
  /**
   * Returns either a structured object (preferred) or a plain string.
   * The transport wraps it in MCP's `content` array automatically.
   */
  handler: (
    input: z.infer<I>,
    ctx: McpAuthContext,
  ) => Promise<unknown> | unknown;
}

export interface McpResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  /** Optional URI template (RFC 6570) for parameterized resources. */
  uriTemplate?: string;
  scopes: string[];
  handler: (
    uri: string,
    ctx: McpAuthContext,
  ) => Promise<{ text: string; mimeType?: string }>;
}

export interface McpPromptDef {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required?: boolean }>;
  handler: (
    args: Record<string, string>,
    ctx: McpAuthContext,
  ) => Promise<{ description?: string; messages: McpPromptMessage[] }>;
}

export interface McpPromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

export interface McpServerConfig {
  name: string;
  version: string;
  instructions?: string;
  tools: McpToolDef[];
  resources: McpResourceDef[];
  prompts: McpPromptDef[];
  /**
   * Resolves an Express request into an authenticated context, or returns
   * `null` if the caller is unauthorized.
   */
  authenticate: (req: Request) => Promise<McpAuthContext | null>;
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function jsonRpcResult(
  id: string | number | null,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  // Minimal Zod -> JSON Schema converter sufficient for tool inputs.
  const def = (schema as { _def: { typeName: string } })._def;
  const tn = def.typeName;
  if (tn === "ZodObject") {
    const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> })
      .shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, child] of Object.entries(shape)) {
      const childDef = (child as { _def: { typeName: string } })._def;
      const isOptional =
        childDef.typeName === "ZodOptional" ||
        childDef.typeName === "ZodDefault";
      const inner = isOptional
        ? (child as unknown as { _def: { innerType: ZodTypeAny } })._def
            .innerType
        : child;
      const sub = zodToJsonSchema(inner);
      const desc = (child as { description?: string }).description;
      if (desc) (sub as { description?: string }).description = desc;
      properties[key] = sub;
      if (!isOptional) required.push(key);
    }
    const out: Record<string, unknown> = {
      type: "object",
      properties,
      additionalProperties: false,
    };
    if (required.length) out.required = required;
    return out;
  }
  if (tn === "ZodString") return { type: "string" };
  if (tn === "ZodNumber") return { type: "number" };
  if (tn === "ZodBoolean") return { type: "boolean" };
  if (tn === "ZodArray") {
    const inner = (schema as unknown as { _def: { type: ZodTypeAny } })._def
      .type;
    return { type: "array", items: zodToJsonSchema(inner) };
  }
  if (tn === "ZodEnum") {
    const values = (schema as unknown as { _def: { values: string[] } })._def
      .values;
    return { type: "string", enum: values };
  }
  if (tn === "ZodLiteral") {
    const value = (schema as unknown as { _def: { value: JsonValue } })._def
      .value;
    return { const: value };
  }
  if (tn === "ZodUnion") {
    const opts = (schema as unknown as { _def: { options: ZodTypeAny[] } })._def
      .options;
    return { anyOf: opts.map(zodToJsonSchema) };
  }
  if (tn === "ZodNullable") {
    const inner = (schema as unknown as { _def: { innerType: ZodTypeAny } })
      ._def.innerType;
    const sub = zodToJsonSchema(inner);
    return { anyOf: [sub, { type: "null" }] };
  }
  return {};
}

export interface McpServerHandlers {
  handle: (
    body: JsonRpcRequest,
    ctx: McpAuthContext,
  ) => Promise<JsonRpcResponse | null>;
  streamableHttp: RequestHandler;
  httpDescriptor: RequestHandler;
  sseConnect: RequestHandler;
  ssePost: RequestHandler;
  descriptor: () => unknown;
}

export function createMcpServer(cfg: McpServerConfig): McpServerHandlers {
  const ensureScope = (ctx: McpAuthContext, required: string[]) => {
    for (const s of required) {
      if (!ctx.scopes.includes(s)) {
        throw new Error(`Missing required scope: ${s}`);
      }
    }
  };

  const handle = async (
    body: JsonRpcRequest,
    ctx: McpAuthContext,
  ): Promise<JsonRpcResponse | null> => {
    const id = body.id ?? null;
    const isNotification = body.id === undefined;

    try {
      switch (body.method) {
        case "initialize": {
          return jsonRpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false, subscribe: false },
              prompts: { listChanged: false },
              logging: {},
            },
            serverInfo: { name: cfg.name, version: cfg.version },
            instructions: cfg.instructions,
          });
        }
        case "notifications/initialized":
        case "notifications/cancelled":
        case "notifications/progress": {
          return null;
        }
        case "ping": {
          return jsonRpcResult(id, {});
        }
        case "tools/list": {
          return jsonRpcResult(id, {
            tools: cfg.tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: zodToJsonSchema(t.inputSchema),
            })),
          });
        }
        case "tools/call": {
          const params = body.params ?? {};
          const name = String(params.name ?? "");
          const args = (params.arguments ?? {}) as Record<string, unknown>;
          const tool = cfg.tools.find((t) => t.name === name);
          if (!tool) {
            return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
          }
          ensureScope(ctx, tool.scopes);
          const parsed = tool.inputSchema.safeParse(args);
          if (!parsed.success) {
            return jsonRpcError(id, -32602, "Invalid tool arguments", {
              issues: parsed.error.issues,
            });
          }
          const out = await tool.handler(parsed.data, ctx);
          const text =
            typeof out === "string" ? out : JSON.stringify(out, null, 2);
          return jsonRpcResult(id, {
            content: [{ type: "text", text }],
            structuredContent: typeof out === "string" ? undefined : out,
            isError: false,
          });
        }
        case "resources/list": {
          return jsonRpcResult(id, {
            resources: cfg.resources
              .filter((r) => !r.uriTemplate)
              .map((r) => ({
                uri: r.uri,
                name: r.name,
                description: r.description,
                mimeType: r.mimeType,
              })),
            resourceTemplates: cfg.resources
              .filter((r) => Boolean(r.uriTemplate))
              .map((r) => ({
                uriTemplate: r.uriTemplate!,
                name: r.name,
                description: r.description,
                mimeType: r.mimeType,
              })),
          });
        }
        case "resources/read": {
          const uri = String(body.params?.uri ?? "");
          const def =
            cfg.resources.find((r) => r.uri === uri) ??
            cfg.resources.find((r) =>
              r.uriTemplate ? matchTemplate(r.uriTemplate, uri) : false,
            );
          if (!def) {
            return jsonRpcError(id, -32602, `Unknown resource: ${uri}`);
          }
          ensureScope(ctx, def.scopes);
          const out = await def.handler(uri, ctx);
          return jsonRpcResult(id, {
            contents: [
              {
                uri,
                mimeType: out.mimeType ?? def.mimeType ?? "text/markdown",
                text: out.text,
              },
            ],
          });
        }
        case "prompts/list": {
          return jsonRpcResult(id, {
            prompts: cfg.prompts.map((p) => ({
              name: p.name,
              description: p.description,
              arguments: p.arguments,
            })),
          });
        }
        case "prompts/get": {
          const name = String(body.params?.name ?? "");
          const args = (body.params?.arguments ?? {}) as Record<string, string>;
          const prompt = cfg.prompts.find((p) => p.name === name);
          if (!prompt) {
            return jsonRpcError(id, -32602, `Unknown prompt: ${name}`);
          }
          const out = await prompt.handler(args, ctx);
          return jsonRpcResult(id, out);
        }
        default: {
          if (isNotification) return null;
          return jsonRpcError(id, -32601, `Method not found: ${body.method}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return jsonRpcError(id, -32603, msg);
    }
  };

  const PUBLIC_METHODS = new Set([
    "initialize",
    "notifications/initialized",
    "ping",
    "tools/list",
    "resources/list",
    "prompts/list",
  ]);
  const isPublic = (m: JsonRpcRequest | JsonRpcRequest[]) => {
    const arr = Array.isArray(m) ? m : [m];
    return arr.every((x) => PUBLIC_METHODS.has(x.method));
  };

  /** Streamable HTTP transport: POST a single JSON-RPC message, get JSON back. */
  const streamableHttp: RequestHandler = async (req, res) => {
    const body = req.body as JsonRpcRequest | JsonRpcRequest[];
    let ctx = await cfg.authenticate(req);
    if (!ctx && !isPublic(body)) {
      res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized" },
      });
      return;
    }
    if (!ctx) {
      // Anonymous handshake — provide a placeholder context.
      ctx = { tenantId: "", userId: "", scopes: [], source: "anonymous" };
    }
    if (Array.isArray(body)) {
      const responses: JsonRpcResponse[] = [];
      for (const m of body) {
        const r = await handle(m, ctx);
        if (r) responses.push(r);
      }
      res.json(responses);
      return;
    }
    const r = await handle(body, ctx);
    if (!r) {
      res.status(204).end();
      return;
    }
    res.json(r);
  };

  /**
   * Discovery endpoint (GET) for the Streamable HTTP transport.
   * Returns the well-known OpenRPC-style descriptor so MCP clients can
   * sniff the protocol version without performing a full initialize.
   */
  const httpDescriptor: RequestHandler = async (_req, res) => {
    res.json({
      protocolVersion: PROTOCOL_VERSION,
      transport: "streamable-http",
      serverInfo: { name: cfg.name, version: cfg.version },
      capabilities: {
        tools: cfg.tools.map((t) => t.name),
        resources: cfg.resources.map((r) => r.uriTemplate ?? r.uri),
        prompts: cfg.prompts.map((p) => p.name),
      },
    });
  };

  /** Legacy SSE transport. */
  const sseSessions = new Map<string, Response>();
  const sseConnect: RequestHandler = async (req, res) => {
    const ctx = await cfg.authenticate(req);
    if (!ctx) {
      res.status(401).end("Unauthorized");
      return;
    }
    const sessionId =
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    sseSessions.set(sessionId, res);
    const messagesUrl = `${
      (req.baseUrl || "") + (req.path.replace(/\/sse$/, "/messages"))
    }?sessionId=${sessionId}`;
    res.write(`event: endpoint\n`);
    res.write(`data: ${messagesUrl}\n\n`);
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      sseSessions.delete(sessionId);
    });
  };
  const ssePost: RequestHandler = async (req, res) => {
    const ctx = await cfg.authenticate(req);
    if (!ctx) {
      res.status(401).end();
      return;
    }
    const sessionId = String(req.query.sessionId ?? "");
    const stream = sseSessions.get(sessionId);
    if (!stream) {
      res.status(404).end("Unknown sessionId");
      return;
    }
    const r = await handle(req.body as JsonRpcRequest, ctx);
    if (r) {
      stream.write(`event: message\n`);
      stream.write(`data: ${JSON.stringify(r)}\n\n`);
    }
    res.status(202).end();
  };

  return {
    handle,
    streamableHttp,
    httpDescriptor,
    sseConnect,
    ssePost,
    descriptor: () => ({
      name: cfg.name,
      version: cfg.version,
      protocolVersion: PROTOCOL_VERSION,
      tools: cfg.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema),
        scopes: t.scopes,
      })),
      resources: cfg.resources.map((r) => ({
        uri: r.uri,
        uriTemplate: r.uriTemplate,
        name: r.name,
        description: r.description,
      })),
      prompts: cfg.prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      })),
    }),
  };
}

function matchTemplate(template: string, uri: string): boolean {
  const re = new RegExp(
    "^" + template.replace(/\{[^}]+\}/g, "([^/]+)").replace(/\//g, "\\/") + "$",
  );
  return re.test(uri);
}

export function extractTemplateVars(
  template: string,
  uri: string,
): Record<string, string> | null {
  const keys: string[] = [];
  const reSrc = template.replace(/\{([^}]+)\}/g, (_m, k) => {
    keys.push(k);
    return "([^/]+)";
  });
  const re = new RegExp("^" + reSrc.replace(/\//g, "\\/") + "$");
  const m = re.exec(uri);
  if (!m) return null;
  const out: Record<string, string> = {};
  keys.forEach((k, i) => (out[k] = m[i + 1]));
  return out;
}
