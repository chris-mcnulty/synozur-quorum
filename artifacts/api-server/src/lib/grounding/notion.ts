import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

interface NotionQuery {
  databaseId?: string | null;
  pageId?: string | null;
  pageSize?: number | null;
}

interface NotionBlock {
  type?: string;
  paragraph?: { rich_text?: Array<{ plain_text?: string }> };
  heading_1?: { rich_text?: Array<{ plain_text?: string }> };
  heading_2?: { rich_text?: Array<{ plain_text?: string }> };
  heading_3?: { rich_text?: Array<{ plain_text?: string }> };
  bulleted_list_item?: { rich_text?: Array<{ plain_text?: string }> };
  numbered_list_item?: { rich_text?: Array<{ plain_text?: string }> };
  to_do?: { rich_text?: Array<{ plain_text?: string }>; checked?: boolean };
  quote?: { rich_text?: Array<{ plain_text?: string }> };
  callout?: { rich_text?: Array<{ plain_text?: string }> };
}

function richTextToString(rt: Array<{ plain_text?: string }> | undefined) {
  return (rt ?? []).map((r) => r.plain_text ?? "").join("");
}

function blockToString(b: NotionBlock): string {
  switch (b.type) {
    case "paragraph":
      return richTextToString(b.paragraph?.rich_text);
    case "heading_1":
      return `# ${richTextToString(b.heading_1?.rich_text)}`;
    case "heading_2":
      return `## ${richTextToString(b.heading_2?.rich_text)}`;
    case "heading_3":
      return `### ${richTextToString(b.heading_3?.rich_text)}`;
    case "bulleted_list_item":
      return `- ${richTextToString(b.bulleted_list_item?.rich_text)}`;
    case "numbered_list_item":
      return `1. ${richTextToString(b.numbered_list_item?.rich_text)}`;
    case "to_do":
      return `- [${b.to_do?.checked ? "x" : " "}] ${richTextToString(b.to_do?.rich_text)}`;
    case "quote":
      return `> ${richTextToString(b.quote?.rich_text)}`;
    case "callout":
      return `! ${richTextToString(b.callout?.rich_text)}`;
    default:
      return "";
  }
}

async function notionFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function fetchNotion(input: FetchInput): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("notion");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "Notion connection not authorized for this workspace.",
    };
  }
  const q = (input.query ?? {}) as NotionQuery;
  const lines: string[] = [];

  try {
    if (q.databaseId) {
      const r = await notionFetch(
        cred.accessToken,
        `/databases/${encodeURIComponent(q.databaseId)}/query`,
        {
          method: "POST",
          body: JSON.stringify({ page_size: Math.min(50, q.pageSize ?? 20) }),
        },
      );
      if (!r.ok) {
        return {
          contentText: "",
          tokenEstimate: 0,
          truncated: false,
          status: "error",
          errorDetail: `Notion DB query HTTP ${r.status}`,
        };
      }
      const data = (await r.json()) as {
        results?: Array<{
          id: string;
          properties?: Record<string, unknown>;
          url?: string;
        }>;
      };
      const results = data.results ?? [];
      lines.push(`# Notion database (${results.length} pages)`);
      for (const row of results) {
        const titleEntry = Object.entries(row.properties ?? {}).find(
          ([, v]) =>
            (v as { type?: string }).type === "title",
        );
        const title = titleEntry
          ? richTextToString(
              (titleEntry[1] as { title?: Array<{ plain_text?: string }> })
                .title,
            )
          : "(untitled)";
        lines.push(`- ${title} — ${row.url ?? row.id}`);
      }
    } else if (q.pageId) {
      const r = await notionFetch(
        cred.accessToken,
        `/blocks/${encodeURIComponent(q.pageId)}/children?page_size=100`,
      );
      if (!r.ok) {
        return {
          contentText: "",
          tokenEstimate: 0,
          truncated: false,
          status: "error",
          errorDetail: `Notion page HTTP ${r.status}`,
        };
      }
      const data = (await r.json()) as { results?: NotionBlock[] };
      const blocks = data.results ?? [];
      lines.push(`# Notion page`);
      for (const b of blocks) {
        const s = blockToString(b);
        if (s) lines.push(s);
      }
    } else {
      return {
        contentText: "",
        tokenEstimate: 0,
        truncated: false,
        status: "error",
        errorDetail: "Notion selector requires databaseId or pageId.",
      };
    }
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Notion request failed",
    };
  }

  if (lines.length === 0) {
    return {
      contentText: "(Notion selector returned no content.)",
      tokenEstimate: 0,
      truncated: false,
      status: "empty",
    };
  }
  const clipped = clipToTokenBudget(lines.join("\n"), input.tokenBudget);
  return {
    contentText: clipped.text,
    tokenEstimate: clipped.tokenEstimate,
    truncated: clipped.truncated,
    status: "ok",
  };
}
