import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Logger } from "pino";

export const MASTER_MODEL_DEFAULT = "claude-opus-4-7";
export const MEMBER_MODEL_DEFAULT = "claude-sonnet-4-6";

// USD per 1M tokens (approximate, configurable).
// 1 cent = 1_000_000 / centsPerMillion ratio
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> =
  {
    "claude-opus-4-7": { input: 15, output: 75 },
    "claude-opus-4-6": { input: 15, output: 75 },
    "claude-opus-4-1": { input: 15, output: 75 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-sonnet-4-5": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 1, output: 5 },
  };

export function computeCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING_USD_PER_MTOK[model] ?? { input: 3, output: 15 };
  const usd =
    (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  return Math.round(usd * 100);
}

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "complete" | "timeout" | "refused" | "error";
  errorDetail?: string;
}

interface CallOptions {
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature?: number;
  logger?: Logger;
}

function isOpus47Family(model: string): boolean {
  return model.startsWith("claude-opus-4-7");
}

async function singleAttempt(opts: CallOptions): Promise<CallResult> {
  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const params: Parameters<typeof anthropic.messages.create>[0] = {
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userMessage }],
    };
    // claude-opus-4-7 forbids temperature/top_p/top_k
    if (!isOpus47Family(opts.model) && typeof opts.temperature === "number") {
      params.temperature = opts.temperature;
    }
    const raw = await anthropic.messages.create(params, {
      signal: ac.signal,
    });
    const message = raw as Extract<typeof raw, { content: unknown }>;

    const text = (message.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("\n")
      .trim();

    const stop = message.stop_reason;
    const latencyMs = Date.now() - start;

    if (stop === "refusal") {
      return {
        text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        latencyMs,
        status: "refused",
        errorDetail: text || "model refused",
      };
    }

    return {
      text,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      latencyMs,
      status: "complete",
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const e = err as { name?: string; status?: number; message?: string };
    if (e?.name === "AbortError" || ac.signal.aborted) {
      return {
        text: "",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        status: "timeout",
        errorDetail: "30s timeout",
      };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function callClaude(opts: CallOptions): Promise<CallResult> {
  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < MAX_RETRIES) {
    try {
      return await singleAttempt(opts);
    } catch (err: unknown) {
      lastErr = err;
      const e = err as { status?: number; message?: string };
      const status = e?.status ?? 0;
      // Retry on 429 / 5xx with exponential backoff
      if (status === 429 || (status >= 500 && status < 600)) {
        attempt += 1;
        if (attempt >= MAX_RETRIES) break;
        const delayMs = 500 * Math.pow(2, attempt);
        opts.logger?.warn(
          { err, attempt, delayMs, model: opts.model },
          "Retrying Claude call after transient error",
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      // Non-retryable error
      opts.logger?.error(
        { err, model: opts.model },
        "Claude call failed (non-retryable)",
      );
      return {
        text: "",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "error",
        errorDetail: e?.message ?? "unknown error",
      };
    }
  }
  const e = lastErr as { message?: string } | undefined;
  return {
    text: "",
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    status: "error",
    errorDetail: e?.message ?? "max retries exceeded",
  };
}
