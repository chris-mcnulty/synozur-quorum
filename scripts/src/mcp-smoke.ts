/**
 * Smoke test for the Quorum MCP server.
 *
 * Boots a JSON-RPC client against http://localhost:80/api/mcp and walks
 * through:
 *   1. initialize
 *   2. tools/list
 *   3. resources/list
 *   4. prompts/list
 *   5. tools/call list_tenants
 *   6. tools/call list_boards
 *
 * Requires:
 *   MCP_KEY  — a Quorum MCP API key (mcp_…).
 *   MCP_URL  — defaults to http://localhost:80/api/mcp.
 *
 * Exits non-zero on any unexpected response.
 */

const URL_BASE = process.env.MCP_URL ?? "http://localhost:80/api/mcp";
const KEY = process.env.MCP_KEY ?? "";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let nextId = 1;

async function call(method: string, params: Record<string, unknown> = {}) {
  const id = nextId++;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (KEY) headers["authorization"] = `Bearer ${KEY}`;
  const res = await fetch(URL_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${method}: ${await res.text()}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  const body = JSON.parse(text) as JsonRpcResponse;
  if (body.error) {
    throw new Error(
      `MCP error on ${method}: ${body.error.code} ${body.error.message}`,
    );
  }
  return body.result;
}

async function main() {
  console.log(`MCP smoke against ${URL_BASE}`);
  if (!KEY) {
    console.warn("Warning: MCP_KEY not set. Auth-protected tools will fail.");
  }

  const init = (await call("initialize", {
    protocolVersion: "2025-06-18",
    clientInfo: { name: "quorum-smoke", version: "0.0.0" },
    capabilities: {},
  })) as { serverInfo: { name: string; version: string } };
  console.log("✓ initialize:", init.serverInfo);

  await call("notifications/initialized");

  const tools = (await call("tools/list")) as {
    tools: Array<{ name: string }>;
  };
  console.log(`✓ tools/list: ${tools.tools.length} tools`);
  const expected = [
    "list_tenants",
    "list_boards",
    "convene_session",
    "wait_for_session_completion",
    "record_decision_outcome",
  ];
  for (const t of expected) {
    if (!tools.tools.find((x) => x.name === t)) {
      throw new Error(`Missing expected tool: ${t}`);
    }
  }

  const resources = (await call("resources/list")) as {
    resources: unknown[];
    resourceTemplates: unknown[];
  };
  console.log(
    `✓ resources/list: ${resources.resources.length} static, ${resources.resourceTemplates.length} templates`,
  );

  const prompts = (await call("prompts/list")) as { prompts: unknown[] };
  console.log(`✓ prompts/list: ${prompts.prompts.length}`);

  if (KEY) {
    const tenants = (await call("tools/call", {
      name: "list_tenants",
      arguments: {},
    })) as { structuredContent: { tenants: unknown[] } };
    console.log(
      `✓ list_tenants: ${tenants.structuredContent?.tenants?.length ?? 0} tenant(s)`,
    );

    const boards = (await call("tools/call", {
      name: "list_boards",
      arguments: {},
    })) as { structuredContent: { boards: unknown[] } };
    console.log(
      `✓ list_boards: ${boards.structuredContent?.boards?.length ?? 0} board(s)`,
    );
  } else {
    console.log("• Skipped tool calls (no MCP_KEY).");
  }

  console.log("All MCP smoke checks passed.");
}

main().catch((err) => {
  console.error("MCP smoke FAILED:", err);
  process.exit(1);
});
