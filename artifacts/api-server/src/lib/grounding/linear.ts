import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

interface LinearQuery {
  label?: string | null;
  team?: string | null;
  states?: string[] | null;
  updatedWithinDays?: number | null;
  limit?: number | null;
}

interface IssueNode {
  identifier: string;
  title: string;
  state?: { name?: string };
  team?: { key?: string; name?: string };
  priority?: number;
  updatedAt?: string;
  url?: string;
  description?: string | null;
  labels?: { nodes?: Array<{ name?: string }> };
  assignee?: { name?: string } | null;
}

export async function fetchLinear(input: FetchInput): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("linear");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "Linear connection not authorized for this workspace.",
    };
  }
  const q = (input.query ?? {}) as LinearQuery;
  const limit = Math.max(1, Math.min(50, q.limit ?? 25));

  const filterParts: string[] = [];
  if (q.label && q.label.trim().length > 0) {
    filterParts.push(
      `labels: { name: { eq: ${JSON.stringify(q.label.trim())} } }`,
    );
  }
  if (q.team && q.team.trim().length > 0) {
    filterParts.push(
      `team: { key: { eq: ${JSON.stringify(q.team.trim().toUpperCase())} } }`,
    );
  }
  if (q.states && q.states.length > 0) {
    filterParts.push(
      `state: { name: { in: ${JSON.stringify(q.states)} } }`,
    );
  }
  if (q.updatedWithinDays && q.updatedWithinDays > 0) {
    const since = new Date(
      Date.now() - q.updatedWithinDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    filterParts.push(`updatedAt: { gte: ${JSON.stringify(since)} }`);
  }
  const filter = filterParts.length
    ? `, filter: { ${filterParts.join(", ")} }`
    : "";

  const gql = `
    query GroundingIssues {
      issues(first: ${limit}${filter}, orderBy: updatedAt) {
        nodes {
          identifier
          title
          priority
          updatedAt
          url
          description
          state { name }
          team { key name }
          labels { nodes { name } }
          assignee { name }
        }
      }
    }
  `;

  let res: Response;
  try {
    res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.accessToken}`,
      },
      body: JSON.stringify({ query: gql }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Linear request failed",
    };
  }
  if (!res.ok) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: `Linear HTTP ${res.status}`,
    };
  }
  const json = (await res.json()) as {
    data?: { issues?: { nodes?: IssueNode[] } };
    errors?: Array<{ message: string }>;
  };
  if (json.errors && json.errors.length > 0) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: json.errors.map((e) => e.message).join("; "),
    };
  }
  const nodes = json.data?.issues?.nodes ?? [];
  if (nodes.length === 0) {
    return {
      contentText: "(No Linear issues matched this selector.)",
      tokenEstimate: 0,
      truncated: false,
      status: "empty",
    };
  }
  const lines: string[] = [
    `# Linear issues (${nodes.length})`,
    `Filters: ${JSON.stringify(q)}`,
    "",
  ];
  for (const n of nodes) {
    const labels = (n.labels?.nodes ?? [])
      .map((l) => l.name)
      .filter(Boolean)
      .join(", ");
    lines.push(
      `## ${n.identifier} — ${n.title}`,
      `state: ${n.state?.name ?? "—"} | team: ${n.team?.key ?? "—"} | priority: P${n.priority ?? 0} | updated: ${n.updatedAt ?? "—"}${labels ? ` | labels: ${labels}` : ""}${n.assignee?.name ? ` | assignee: ${n.assignee.name}` : ""}`,
    );
    if (n.description && n.description.trim().length > 0) {
      lines.push("", n.description.trim());
    }
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
