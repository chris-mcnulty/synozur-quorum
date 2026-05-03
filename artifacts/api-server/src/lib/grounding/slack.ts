import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

interface SlackQuery {
  channel?: string | null; // channel ID (C…) or name (without #)
  limit?: number | null;
  daysBack?: number | null;
}

interface SlackChannel {
  id: string;
  name?: string;
  is_archived?: boolean;
}

interface SlackMessage {
  ts?: string;
  user?: string;
  username?: string;
  text?: string;
  subtype?: string;
}

interface SlackUser {
  id: string;
  real_name?: string;
  name?: string;
}

async function slack(
  token: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<Response> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return fetch(`https://slack.com/api/${path}?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
}

async function resolveChannelId(
  token: string,
  channel: string,
): Promise<string | null> {
  if (/^[CG][A-Z0-9]+$/.test(channel)) return channel;
  const name = channel.replace(/^#/, "").trim().toLowerCase();
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const r = await slack(token, "conversations.list", {
      limit: 200,
      exclude_archived: "true",
      types: "public_channel,private_channel",
      cursor,
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      ok: boolean;
      channels?: SlackChannel[];
      response_metadata?: { next_cursor?: string };
    };
    if (!data.ok) return null;
    const found = (data.channels ?? []).find(
      (c) => (c.name ?? "").toLowerCase() === name,
    );
    if (found) return found.id;
    cursor = data.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return null;
}

export async function fetchSlack(input: FetchInput): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("slack");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "Slack connection not authorized for this workspace.",
    };
  }
  const q = (input.query ?? {}) as SlackQuery;
  if (!q.channel || q.channel.trim().length === 0) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: "Slack selector requires a `channel` (id or name).",
    };
  }
  const limit = Math.max(1, Math.min(200, q.limit ?? 30));
  const daysBack = q.daysBack && q.daysBack > 0 ? q.daysBack : 7;

  let channelId: string | null;
  try {
    channelId = await resolveChannelId(cred.accessToken, q.channel.trim());
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Slack channel lookup failed",
    };
  }
  if (!channelId) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: `Slack channel not found: ${q.channel}`,
    };
  }

  const oldest = (
    (Date.now() - daysBack * 24 * 60 * 60 * 1000) /
    1000
  ).toFixed(0);

  let messages: SlackMessage[] = [];
  try {
    const r = await slack(cred.accessToken, "conversations.history", {
      channel: channelId,
      limit,
      oldest,
    });
    if (!r.ok) {
      return {
        contentText: "",
        tokenEstimate: 0,
        truncated: false,
        status: "error",
        errorDetail: `Slack history HTTP ${r.status}`,
      };
    }
    const data = (await r.json()) as {
      ok: boolean;
      error?: string;
      messages?: SlackMessage[];
    };
    if (!data.ok) {
      return {
        contentText: "",
        tokenEstimate: 0,
        truncated: false,
        status: "error",
        errorDetail: `Slack error: ${data.error ?? "unknown"}`,
      };
    }
    messages = data.messages ?? [];
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Slack request failed",
    };
  }

  if (messages.length === 0) {
    return {
      contentText: `(No Slack messages in #${q.channel} in the last ${daysBack} day(s).)`,
      tokenEstimate: 0,
      truncated: false,
      status: "empty",
    };
  }

  // Resolve user names for the first batch (best-effort, capped).
  const userIds = Array.from(
    new Set(messages.map((m) => m.user).filter((u): u is string => Boolean(u))),
  ).slice(0, 25);
  const userMap: Record<string, string> = {};
  for (const uid of userIds) {
    try {
      const r = await slack(cred.accessToken, "users.info", { user: uid });
      if (!r.ok) continue;
      const data = (await r.json()) as { ok: boolean; user?: SlackUser };
      if (data.ok && data.user) {
        userMap[uid] = data.user.real_name || data.user.name || uid;
      }
    } catch {
      // ignore
    }
  }

  const ordered = [...messages].reverse(); // chronological
  const lines: string[] = [
    `# Slack #${q.channel} (${ordered.length} messages, last ${daysBack}d)`,
    "",
  ];
  for (const m of ordered) {
    if (m.subtype && m.subtype !== "thread_broadcast") continue;
    const who = m.user ? userMap[m.user] ?? m.user : m.username ?? "unknown";
    const ts = m.ts ? new Date(Number(m.ts) * 1000).toISOString() : "—";
    const text = (m.text ?? "").trim();
    if (!text) continue;
    lines.push(`- [${ts}] **${who}**: ${text}`);
  }

  const clipped = clipToTokenBudget(lines.join("\n"), input.tokenBudget);
  return {
    contentText: clipped.text,
    tokenEstimate: clipped.tokenEstimate,
    truncated: clipped.truncated,
    status: "ok",
  };
}
