import { useState } from "react";
import { useListSessionGroundingSnapshots } from "@workspace/api-client-react";
import { ChevronDown, ChevronUp, Database } from "lucide-react";
import { citationAnchorId } from "@/lib/citations";

const PROVIDER_LABELS: Record<string, string> = {
  linear: "Linear",
  notion: "Notion",
  "google-docs": "Google Docs",
  github: "GitHub",
};

export function SessionGroundedBy({ sessionId }: { sessionId: string }) {
  const { data: snapshots } = useListSessionGroundingSnapshots(sessionId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!snapshots || snapshots.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 border-b boa-rule-strong pb-2 mb-4">
        <Database className="w-4 h-4" style={{ color: "var(--boa-brass)" }} />
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Grounded by ({snapshots.length})
        </h2>
        <span
          className="boa-mono text-[10px]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Live snapshots fetched at session start
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {snapshots.map((s) => {
          const isOk = s.fetchStatus === "ok";
          const expanded = expandedId === s.id;
          const anchorId = citationAnchorId(s.id);
          return (
            <div
              key={s.id}
              id={anchorId}
              data-citation-id={s.id}
              className="p-4 border rounded-sm transition-shadow"
              style={{
                borderColor: isOk
                  ? "var(--boa-paper-3)"
                  : "rgba(196,106,42,0.4)",
                background: isOk ? "var(--boa-paper-2)" : "rgba(196,106,42,0.05)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="boa-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm"
                  style={{
                    background: "var(--boa-paper)",
                    color: "var(--boa-ink-2)",
                  }}
                >
                  {PROVIDER_LABELS[s.provider] ?? s.provider}
                </span>
                <span
                  className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                  style={{
                    color: isOk ? "var(--boa-vote-yes)" : "var(--boa-flag)",
                  }}
                >
                  {s.fetchStatus}
                </span>
                {s.boardMemberId && (
                  <span
                    className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    advisor-scoped
                  </span>
                )}
              </div>
              <div
                className="text-[14px] font-medium mb-1"
                style={{ color: "var(--boa-ink)" }}
              >
                {s.selectorName}
              </div>
              <div
                className="boa-mono text-[10px] mb-3 truncate"
                style={{ color: "var(--boa-ink-3)" }}
              >
                {JSON.stringify(s.queryJson)}
              </div>
              <div
                className="flex items-center gap-3 boa-mono text-[10px]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                <span>~{s.tokenEstimate} tok</span>
                {s.truncated && (
                  <span style={{ color: "var(--boa-flag)" }}>truncated</span>
                )}
                <span>{new Date(s.fetchedAt).toLocaleTimeString()}</span>
              </div>
              {s.errorDetail && (
                <div
                  className="mt-2 text-[11.5px]"
                  style={{ color: "var(--boa-flag)" }}
                >
                  {s.errorDetail}
                </div>
              )}
              {s.contentText && (
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  className="mt-3 inline-flex items-center gap-1 boa-mono text-[10px] uppercase tracking-[0.15em]"
                  style={{ color: "var(--boa-brass)" }}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" /> Hide snapshot
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" /> View snapshot
                    </>
                  )}
                </button>
              )}
              {expanded && (
                <pre
                  className="mt-2 p-3 rounded-sm boa-mono text-[10.5px] whitespace-pre-wrap max-h-[260px] overflow-auto"
                  style={{
                    background: "var(--boa-paper)",
                    color: "var(--boa-ink-2)",
                    border: "1px solid var(--boa-paper-3)",
                  }}
                >
                  {s.contentText}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
