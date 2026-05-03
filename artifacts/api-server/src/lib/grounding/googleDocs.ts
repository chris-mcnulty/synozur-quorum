import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

interface DocsQuery {
  documentId?: string | null;
}

interface ParagraphElement {
  textRun?: { content?: string };
}
interface StructuralElement {
  paragraph?: { elements?: ParagraphElement[] };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{ content?: StructuralElement[] }>;
    }>;
  };
}

function flatten(elements: StructuralElement[] | undefined): string {
  if (!elements) return "";
  const out: string[] = [];
  for (const el of elements) {
    if (el.paragraph?.elements) {
      out.push(
        el.paragraph.elements
          .map((e) => e.textRun?.content ?? "")
          .join(""),
      );
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const cells = (row.tableCells ?? []).map((c) =>
          flatten(c.content).trim(),
        );
        out.push(`| ${cells.join(" | ")} |`);
      }
    }
  }
  return out.join("");
}

export async function fetchGoogleDocs(
  input: FetchInput,
): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("google-docs");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "Google Docs connection not authorized.",
    };
  }
  const q = (input.query ?? {}) as DocsQuery;
  if (!q.documentId) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: "Google Docs selector requires a documentId.",
    };
  }
  let res: Response;
  try {
    res = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(q.documentId)}`,
      {
        headers: { Authorization: `Bearer ${cred.accessToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "Google Docs request failed",
    };
  }
  if (!res.ok) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: `Google Docs HTTP ${res.status}`,
    };
  }
  const data = (await res.json()) as {
    title?: string;
    body?: { content?: StructuralElement[] };
  };
  const text = `# ${data.title ?? "(untitled doc)"}\n\n${flatten(data.body?.content)}`.trim();
  if (text.length === 0) {
    return {
      contentText: "(Google Doc was empty.)",
      tokenEstimate: 0,
      truncated: false,
      status: "empty",
    };
  }
  const clipped = clipToTokenBudget(text, input.tokenBudget);
  return {
    contentText: clipped.text,
    tokenEstimate: clipped.tokenEstimate,
    truncated: clipped.truncated,
    status: "ok",
  };
}
