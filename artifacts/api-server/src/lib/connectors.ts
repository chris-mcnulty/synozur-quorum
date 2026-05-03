// Lightweight client for Replit's connector credential proxy.
// Used to retrieve OAuth access tokens for Slack and Notion connections that
// the user has authorized at the account level.

import type { MemoSection } from "@workspace/api-zod";

const HOSTNAME = process.env.REPLIT_CONNECTORS_HOSTNAME;

function getAuthToken(): string | null {
  return process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;
}

export type ConnectorTokenInfo = {
  accessToken: string;
};

type ConnectorItem = {
  settings?: {
    access_token?: string;
    oauth?: { credentials?: { access_token?: string } };
  };
};
type ConnectorListResponse = { items?: ConnectorItem[] };

function readJson(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}
function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function errorMessage(err: unknown, fallback = "Unknown error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

export async function getConnectorAccessToken(
  connectorName: "slack" | "notion",
): Promise<ConnectorTokenInfo | null> {
  if (!HOSTNAME) return null;
  const xReplitToken = getAuthToken();
  if (!xReplitToken) return null;

  const url =
    `https://${HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=` +
    encodeURIComponent(connectorName);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as ConnectorListResponse | null;
  const item = json?.items?.[0];
  if (!item) return null;

  const accessToken =
    item.settings?.access_token ||
    item.settings?.oauth?.credentials?.access_token ||
    null;
  if (!accessToken) return null;
  return { accessToken };
}

export async function getSlackToken(): Promise<ConnectorTokenInfo | null> {
  return getConnectorAccessToken("slack");
}
export async function getNotionToken(): Promise<ConnectorTokenInfo | null> {
  return getConnectorAccessToken("notion");
}

// --- Slack helpers ----------------------------------------------------------

export type SlackChannelLite = {
  id: string;
  name: string;
  isPrivate: boolean;
};

type SlackResponse = {
  ok?: boolean;
  error?: string;
} & Record<string, unknown>;

async function slackFetch(
  token: string,
  method: string,
  params: Record<string, string | undefined>,
): Promise<SlackResponse> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    search.set(k, v);
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: search.toString(),
  });
  const json = (await res.json().catch(() => null)) as SlackResponse | null;
  if (!json?.ok) {
    throw new Error(`Slack ${method} failed: ${json?.error ?? `HTTP ${res.status}`}`);
  }
  return json;
}

type SlackChannelRaw = { id: string; name: string; is_private?: boolean };
type SlackListChannelsResponse = SlackResponse & {
  channels?: SlackChannelRaw[];
  response_metadata?: { next_cursor?: string };
};

export async function listSlackChannelsApi(token: string): Promise<SlackChannelLite[]> {
  const out: SlackChannelLite[] = [];
  let cursor: string | undefined;
  do {
    const json = (await slackFetch(token, "conversations.list", {
      exclude_archived: "true",
      types: "public_channel,private_channel",
      limit: "200",
      cursor,
    })) as SlackListChannelsResponse;
    for (const c of json.channels ?? []) {
      out.push({ id: c.id, name: c.name, isPrivate: !!c.is_private });
    }
    cursor = json.response_metadata?.next_cursor || undefined;
  } while (cursor && out.length < 1000);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function getSlackTeamName(token: string): Promise<string | null> {
  try {
    const json = await slackFetch(token, "auth.test", {});
    return readString(json.team) ?? null;
  } catch {
    return null;
  }
}

export async function postSlackMessage(
  token: string,
  channelId: string,
  text: string,
): Promise<{ ts: string; permalink: string | null; channel: string }> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channelId,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | (SlackResponse & { ts?: string; channel?: string })
    | null;
  if (!json?.ok || !json.ts || !json.channel) {
    throw new Error(`Slack chat.postMessage failed: ${json?.error ?? `HTTP ${res.status}`}`);
  }

  let permalink: string | null = null;
  try {
    const linkRes = await fetch(
      `https://slack.com/api/chat.getPermalink?channel=${encodeURIComponent(json.channel)}&message_ts=${encodeURIComponent(json.ts)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const linkJson = (await linkRes.json().catch(() => null)) as
      | (SlackResponse & { permalink?: string })
      | null;
    if (linkJson?.ok && linkJson.permalink) permalink = linkJson.permalink;
  } catch {
    // permalink is best-effort
  }
  return { ts: json.ts, permalink, channel: json.channel };
}

// --- Notion helpers ---------------------------------------------------------

export type NotionPageLite = {
  id: string;
  title: string;
  url: string | null;
};

const NOTION_VERSION = "2022-06-28";

async function notionFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const raw = await res.json().catch(() => null);
  const json = readJson(raw) ?? {};
  if (!res.ok) {
    const msg = readString(json["message"]) ?? `HTTP ${res.status}`;
    throw new Error(`Notion ${path} failed: ${msg}`);
  }
  return json;
}

type NotionRichTextItem = { plain_text?: string };
type NotionTitleProp = { type?: string; title?: NotionRichTextItem[] };
type NotionPageRaw = {
  id?: string;
  url?: string | null;
  properties?: Record<string, NotionTitleProp>;
  title?: NotionRichTextItem[] | unknown;
};

function extractNotionTitle(p: NotionPageRaw): string {
  const props = p.properties ?? {};
  for (const v of Object.values(props)) {
    if (v?.type === "title" && Array.isArray(v.title)) {
      const t = v.title.map((x) => x?.plain_text ?? "").join("");
      if (t) return t;
    }
  }
  if (Array.isArray(p.title)) {
    return p.title.map((x) => x?.plain_text ?? "").join("");
  }
  return "Untitled";
}

export async function listNotionParentPagesApi(token: string): Promise<NotionPageLite[]> {
  const json = await notionFetch(token, "/search", {
    method: "POST",
    body: JSON.stringify({
      filter: { value: "page", property: "object" },
      page_size: 50,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });
  const results = Array.isArray(json["results"])
    ? (json["results"] as NotionPageRaw[])
    : [];
  return results
    .filter((p): p is NotionPageRaw & { id: string } => typeof p.id === "string")
    .map((p) => ({
      id: p.id,
      title: extractNotionTitle(p),
      url: typeof p.url === "string" ? p.url : null,
    }));
}

export async function getNotionWorkspaceName(token: string): Promise<string | null> {
  try {
    const json = await notionFetch(token, "/users/me", { method: "GET" });
    const bot = readJson(json["bot"]);
    return readString(bot?.["workspace_name"]) ?? readString(json["name"]) ?? null;
  } catch {
    return null;
  }
}

// --- Notion block builders driven by the shared MemoSection model ----------

type NotionRichText = { type: "text"; text: { content: string } };
type NotionBlock =
  | {
      object: "block";
      type: "paragraph";
      paragraph: { rich_text: NotionRichText[] };
    }
  | {
      object: "block";
      type: "heading_1" | "heading_2" | "heading_3";
      heading_1?: { rich_text: NotionRichText[] };
      heading_2?: { rich_text: NotionRichText[] };
      heading_3?: { rich_text: NotionRichText[] };
    }
  | { object: "block"; type: "divider"; divider: Record<string, never> };

function chunkText(text: string, max = 1900): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n/, "");
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

function paragraphBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}
function headingBlock(level: 1 | 2 | 3, text: string): NotionBlock {
  const rich: NotionRichText[] = [{ type: "text", text: { content: text } }];
  if (level === 1) {
    return { object: "block", type: "heading_1", heading_1: { rich_text: rich } };
  }
  if (level === 2) {
    return { object: "block", type: "heading_2", heading_2: { rich_text: rich } };
  }
  return { object: "block", type: "heading_3", heading_3: { rich_text: rich } };
}
function dividerBlock(): NotionBlock {
  return { object: "block", type: "divider", divider: {} };
}

export function memoSectionsToNotionBlocks(sections: MemoSection[]): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  for (const s of sections) {
    switch (s.kind) {
      case "header":
        blocks.push(headingBlock(2, "Question"));
        for (const c of chunkText(s.questionText)) blocks.push(paragraphBlock(c));
        break;
      case "text":
        blocks.push(headingBlock(2, s.label));
        for (const c of chunkText(s.body)) blocks.push(paragraphBlock(c));
        break;
      case "voteTally":
        blocks.push(headingBlock(2, "Vote tally"));
        blocks.push(
          paragraphBlock(`Yes ${s.yes} · No ${s.no} · Abstain ${s.abstain}`),
        );
        for (const v of s.votes) {
          blocks.push(
            paragraphBlock(
              `• ${v.memberName ?? "Advisor"} (${v.memberRoleTitle ?? ""}) — ${v.vote ?? "—"}`,
            ),
          );
        }
        break;
      case "footer":
        blocks.push(dividerBlock());
        blocks.push(paragraphBlock(`Signed by the ${s.boardName} · ${s.date}`));
        break;
    }
  }
  return blocks;
}

export async function createNotionPageApi(
  token: string,
  parentPageId: string,
  title: string,
  blocks: NotionBlock[],
): Promise<{ id: string; url: string | null }> {
  const json = await notionFetch(token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children: blocks.slice(0, 100),
    }),
  });
  const pageId = readString(json["id"]);
  if (!pageId) {
    throw new Error("Notion /pages did not return a page id");
  }

  const remaining = blocks.slice(100);
  for (let i = 0; i < remaining.length; i += 100) {
    await notionFetch(token, `/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: remaining.slice(i, i + 100) }),
    });
  }
  return { id: pageId, url: readString(json["url"]) ?? null };
}

export { errorMessage };
