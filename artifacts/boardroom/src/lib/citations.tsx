import { Fragment, type ReactNode } from "react";

export function citationAnchorId(snapshotId: string): string {
  return `grounded-${snapshotId}`;
}

const CITATION_RE = /\[grounded:([^\]]+)\]/g;

export interface CitationTarget {
  snapshotId: string;
  label: string;
  anchorId: string;
}

export function renderWithCitations(
  text: string,
  targets: Map<string, CitationTarget>,
  onCite: (target: CitationTarget) => void,
): ReactNode[] {
  if (!text) return [];
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  let i = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(
        <Fragment key={`t-${i}`}>{text.slice(lastIndex, match.index)}</Fragment>,
      );
    }
    const id = match[1].trim();
    const target = targets.get(id);
    if (target) {
      out.push(
        <button
          key={`c-${i}`}
          type="button"
          onClick={() => onCite(target)}
          className="inline-flex items-baseline align-baseline boa-mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 mx-0.5 rounded-sm hover:underline"
          style={{
            background: "rgba(184,134,11,0.12)",
            color: "var(--boa-brass)",
            border: "1px solid rgba(184,134,11,0.3)",
          }}
          data-testid={`citation-${target.snapshotId}`}
          title={`Jump to snapshot: ${target.label}`}
        >
          {target.label}
        </button>,
      );
    } else {
      const short = id.length > 10 ? `${id.slice(0, 8)}…` : id;
      out.push(
        <span
          key={`c-${i}`}
          className="boa-mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 mx-0.5 rounded-sm"
          style={{
            background: "rgba(196,106,42,0.12)",
            color: "var(--boa-flag)",
            border: "1px solid rgba(196,106,42,0.3)",
          }}
          title={`Citation id ${id} did not match any snapshot`}
        >
          ?{short}
        </span>,
      );
    }
    lastIndex = match.index + match[0].length;
    i++;
  }
  if (lastIndex < text.length) {
    out.push(<Fragment key={`t-end`}>{text.slice(lastIndex)}</Fragment>);
  }
  return out;
}

const GROUNDING_KEYWORDS_RE =
  /\b(per|according to|based on|as shown in|as noted in)\b.*?\b(snapshot|linear|notion|github|google[\s-]?docs?|grounding|ticket|issue|pr|pull request|doc)\b/i;

export function findUncitedGroundedSpans(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const segments = text.split(/(?<=[.!?\n])\s+/);
  for (const seg of segments) {
    if (!GROUNDING_KEYWORDS_RE.test(seg)) continue;
    if (/\[grounded:[^\]]+\]/.test(seg)) continue;
    out.push(seg.trim());
  }
  return out;
}

export function scrollToCitation(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("citation-flash");
  window.setTimeout(() => el.classList.remove("citation-flash"), 1600);
}
