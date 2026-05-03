import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

interface JiraQuery {
  jql?: string | null;
  cloudId?: string | null;
  fields?: string[] | null;
  limit?: number | null;
}

interface AccessibleResource {
  id: string;
  url?: string;
  name?: string;
  scopes?: string[];
}

interface JiraIssue {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    priority?: { name?: string };
    issuetype?: { name?: string };
    assignee?: { displayName?: string } | null;
    reporter?: { displayName?: string } | null;
    updated?: string;
    labels?: string[];
    description?: unknown;
  };
}

function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    const inner = n.content.map(adfToText).join("");
    if (n.type === "paragraph" || n.type === "heading") return inner + "\n";
    return inner;
  }
  return "";
}

async function resolveCloudId(token: string): Promise<string | null> {
  const r = await fetch(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!r.ok) return null;
  const data = (await r.json()) as AccessibleResource[];
  const jira = data.find((d) =>
    (d.scopes ?? []).some((s) => s.includes("jira")),
  );
  return (jira ?? data[0])?.id ?? null;
}

export async function fetchJira(input: FetchInput): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("jira");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "Jira connection not authorized for this workspace.",
    };
  }
  const q = (input.query ?? {}) as JiraQuery;
  if (!q.jql || q.jql.trim().length === 0) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: "Jira selector requires a `jql` query.",
    };
  }
  const limit = Math.max(1, Math.min(50, q.limit ?? 25));
  const fields = q.fields?.length
    ? q.fields
    : [
        "summary",
        "status",
        "priority",
        "issuetype",
        "assignee",
        "reporter",
        "updated",
        "labels",
        "description",
      ];

  let cloudId = q.cloudId ?? null;
  try {
    if (!cloudId) cloudId = await resolveCloudId(cred.accessToken);
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Jira cloudId lookup failed",
    };
  }
  if (!cloudId) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail:
        "No accessible Jira site found for the connected account. Set `cloudId` in the selector.",
    };
  }

  let issues: JiraIssue[] = [];
  try {
    const r = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cred.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jql: q.jql,
          maxResults: limit,
          fields,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return {
        contentText: "",
        tokenEstimate: 0,
        truncated: false,
        status: "error",
        errorDetail: `Jira HTTP ${r.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await r.json()) as { issues?: JiraIssue[] };
    issues = data.issues ?? [];
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Jira request failed",
    };
  }

  if (issues.length === 0) {
    return {
      contentText: "(No Jira issues matched this JQL.)",
      tokenEstimate: 0,
      truncated: false,
      status: "empty",
    };
  }

  const lines: string[] = [
    `# Jira issues (${issues.length})`,
    `JQL: ${q.jql}`,
    "",
  ];
  for (const i of issues) {
    const f = i.fields ?? {};
    const labels = (f.labels ?? []).join(", ");
    lines.push(
      `## ${i.key} — ${f.summary ?? ""}`,
      `type: ${f.issuetype?.name ?? "—"} | status: ${f.status?.name ?? "—"} | priority: ${f.priority?.name ?? "—"} | updated: ${f.updated ?? "—"}${f.assignee?.displayName ? ` | assignee: ${f.assignee.displayName}` : ""}${labels ? ` | labels: ${labels}` : ""}`,
    );
    const desc = adfToText(f.description).trim();
    if (desc) lines.push("", desc);
    lines.push("");
  }

  const clipped = clipToTokenBudget(lines.join("\n"), input.tokenBudget);
  return {
    contentText: clipped.text,
    tokenEstimate: clipped.tokenEstimate,
    truncated: clipped.truncated,
    status: "ok",
  };
}
