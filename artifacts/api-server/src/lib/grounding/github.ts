import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

interface GithubQuery {
  repo?: string | null; // "owner/name"
  ref?: string | null;
  paths?: string[] | null;
  mode?: "files" | "issues" | "readme" | null;
  state?: "open" | "closed" | "all" | null;
  limit?: number | null;
}

async function gh(token: string, path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "quorum-grounding",
    },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function fetchGithub(input: FetchInput): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("github");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "GitHub connection not authorized.",
    };
  }
  const q = (input.query ?? {}) as GithubQuery;
  if (!q.repo || !/^[^/]+\/[^/]+$/.test(q.repo)) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: "GitHub selector requires repo in 'owner/name' form.",
    };
  }
  const mode = q.mode ?? (q.paths?.length ? "files" : "readme");
  const lines: string[] = [`# GitHub: ${q.repo}`];

  try {
    if (mode === "readme") {
      const r = await gh(cred.accessToken, `/repos/${q.repo}/readme`);
      if (!r.ok) {
        return {
          contentText: "",
          tokenEstimate: 0,
          truncated: false,
          status: "error",
          errorDetail: `GitHub readme HTTP ${r.status}`,
        };
      }
      const data = (await r.json()) as {
        content?: string;
        encoding?: string;
        path?: string;
      };
      lines.push(`## ${data.path ?? "README"}`);
      if (data.encoding === "base64" && data.content) {
        lines.push(Buffer.from(data.content, "base64").toString("utf-8"));
      }
    } else if (mode === "files") {
      const ref = q.ref ?? "HEAD";
      for (const p of q.paths ?? []) {
        const r = await gh(
          cred.accessToken,
          `/repos/${q.repo}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(ref)}`,
        );
        if (!r.ok) {
          lines.push(`## ${p}\n[error: HTTP ${r.status}]`);
          continue;
        }
        const data = (await r.json()) as {
          content?: string;
          encoding?: string;
          path?: string;
          type?: string;
        };
        if (data.type !== "file" || data.encoding !== "base64") {
          lines.push(`## ${p}\n[skipped: ${data.type ?? "unknown"}]`);
          continue;
        }
        const decoded = Buffer.from(data.content ?? "", "base64").toString(
          "utf-8",
        );
        lines.push(`## ${data.path ?? p}`, "```", decoded, "```");
      }
    } else if (mode === "issues") {
      const limit = Math.max(1, Math.min(50, q.limit ?? 20));
      const state = q.state ?? "open";
      const r = await gh(
        cred.accessToken,
        `/repos/${q.repo}/issues?state=${state}&per_page=${limit}`,
      );
      if (!r.ok) {
        return {
          contentText: "",
          tokenEstimate: 0,
          truncated: false,
          status: "error",
          errorDetail: `GitHub issues HTTP ${r.status}`,
        };
      }
      const issues = (await r.json()) as Array<{
        number: number;
        title: string;
        state: string;
        body?: string | null;
        labels?: Array<{ name?: string }>;
        updated_at?: string;
        html_url?: string;
        pull_request?: unknown;
      }>;
      const filtered = issues.filter((i) => !i.pull_request);
      lines.push(`## Issues (${filtered.length}, state=${state})`);
      for (const i of filtered) {
        const labels = (i.labels ?? [])
          .map((l) => l.name)
          .filter(Boolean)
          .join(", ");
        lines.push(
          `\n### #${i.number} ${i.title}`,
          `state: ${i.state} | updated: ${i.updated_at ?? "—"}${labels ? ` | labels: ${labels}` : ""}`,
        );
        if (i.body) lines.push("", i.body.trim());
      }
    }
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "GitHub request failed",
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
