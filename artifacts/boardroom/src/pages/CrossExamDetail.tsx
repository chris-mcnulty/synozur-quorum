import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetCrossExamination,
  CrossExaminationStatus,
  type CrossExamChildSession,
} from "@workspace/api-client-react";
import { ChevronLeft, Loader2, Layers3, Printer } from "lucide-react";

interface ChildEvent {
  phase: string;
  sessionId?: string;
  boardId?: string;
  event?: {
    type: string;
    payload?: any;
  };
}

interface SynthesisPayload {
  phase?: "started" | "complete";
  alignmentMatrix?: Array<{
    topic: string;
    verdicts: Array<{ boardId: string; boardName: string; stance: string }>;
  }>;
  uniqueInsights?: Array<{
    boardId: string;
    boardName: string;
    insight: string;
  }>;
  metaRecommendation?: string;
  synthesisNarrative?: string;
}

interface BoardLiveState {
  boardId: string;
  events: { kind: string; text: string; at: number }[];
  status: "running" | "complete" | "failed";
}

export default function CrossExamDetail({ crossExamId }: { crossExamId: string }) {
  const { data, isLoading, refetch } = useGetCrossExamination(crossExamId);
  const [liveStates, setLiveStates] = useState<Record<string, BoardLiveState>>({});
  const [streamSynth, setStreamSynth] = useState<SynthesisPayload | null>(null);
  const [synthStatus, setSynthStatus] = useState<"idle" | "running" | "complete">(
    "idle",
  );

  const isLive = data?.crossExamination.status === CrossExaminationStatus.running;

  useEffect(() => {
    if (!isLive) return;
    const es = new EventSource(
      `/api/cross-examinations/${crossExamId}/stream`,
      { withCredentials: true },
    );

    es.addEventListener("progress", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as ChildEvent &
          SynthesisPayload;
        if (d.phase === "child_event" && d.boardId && d.event) {
          const phase = d.event.type;
          const p = d.event.payload as any;
          let label = phase;
          if (phase === "member_started") {
            label = `${p?.name ?? "Advisor"} deliberating…`;
          } else if (phase === "member_done") {
            label = `${p?.contribution?.memberName ?? "Advisor"} contributed`;
          } else if (phase === "framing") {
            label = "Chair framed the question";
          } else if (phase === "convergence") {
            label = "Master synthesized convergence";
          } else if (phase === "started") {
            label = "Session started";
          }
          setLiveStates((prev) => {
            const cur = prev[d.boardId!] ?? {
              boardId: d.boardId!,
              events: [],
              status: "running" as const,
            };
            return {
              ...prev,
              [d.boardId!]: {
                ...cur,
                events: [
                  ...cur.events,
                  { kind: phase, text: label, at: Date.now() },
                ],
              },
            };
          });
        } else if (d.phase === "child_complete" && d.boardId) {
          setLiveStates((prev) => ({
            ...prev,
            [d.boardId!]: {
              ...(prev[d.boardId!] ?? {
                boardId: d.boardId!,
                events: [],
                status: "running" as const,
              }),
              status: "complete",
            },
          }));
        } else if (d.phase === "synthesis") {
          if (d.phase === "synthesis" && (d as any).phase === "synthesis") {
            const inner = d as SynthesisPayload;
            if (inner.phase === "started") {
              setSynthStatus("running");
            } else if (inner.phase === "complete") {
              setStreamSynth(inner);
              setSynthStatus("complete");
            }
          }
        }
      } catch {}
    });

    es.addEventListener("done", () => {
      es.close();
      refetch();
    });
    es.addEventListener("error", () => {
      es.close();
      refetch();
    });

    return () => es.close();
  }, [crossExamId, isLive, refetch]);

  const children = data?.children ?? [];

  const alignmentMatrix =
    streamSynth?.alignmentMatrix ?? (data?.alignmentMatrix as any) ?? [];
  const uniqueInsights =
    streamSynth?.uniqueInsights ?? (data?.uniqueInsights as any) ?? [];
  const metaRecommendation =
    streamSynth?.metaRecommendation ?? data?.metaRecommendation ?? null;
  const synthesisNarrative =
    streamSynth?.synthesisNarrative ?? data?.synthesisNarrative ?? null;

  const boardOrder = useMemo(
    () => children.map((c: CrossExamChildSession) => c.boardId),
    [children],
  );

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-8 py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  }
  if (!data) return <div className="px-8 py-12">Cross-examination not found</div>;

  const tenantId = data.crossExamination.tenantId;

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-12 pb-32">
      <Link
        href={`/t/${tenantId}`}
        className="inline-flex items-center text-[12px] mb-6 boa-mono uppercase tracking-[0.15em] hover:underline"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Back to overview
      </Link>

      <header className="mb-12 pb-8 border-b boa-rule-strong">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span
            className="boa-mono text-[11px] uppercase tracking-[0.2em] flex items-center gap-1.5"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <Layers3 className="w-3.5 h-3.5" />
            Cross-examination — #{data.crossExamination.id.slice(0, 8)}
          </span>
          {isLive && (
            <span
              className="flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-brass)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full boa-pulse"
                style={{ background: "var(--boa-brass)" }}
              />
              Live
            </span>
          )}
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm"
            style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
          >
            {data.crossExamination.mode}
          </span>
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm"
            style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
          >
            {children.length} boards
          </span>
        </div>
        <h1
          className="boa-display text-[40px] leading-[1.15] italic mb-4"
          style={{ color: "var(--boa-ink)" }}
        >
          “{data.crossExamination.questionText}”
        </h1>
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Convened {new Date(data.crossExamination.startedAt).toLocaleString()}
          {data.crossExamination.completedAt && (
            <>
              {" · Completed "}
              {new Date(data.crossExamination.completedAt).toLocaleString()}
            </>
          )}
          {typeof data.crossExamination.totalCostCents === "number" && (
            <> · ${(data.crossExamination.totalCostCents / 100).toFixed(4)}</>
          )}
        </div>
      </header>

      {/* Side-by-side board columns */}
      <section className="mb-14">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-6 pb-2 border-b boa-rule"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Per-board deliberation
        </h2>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(children.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {children.map((c) => {
            const live = liveStates[c.boardId];
            const status = live?.status ?? c.status;
            return (
              <div
                key={c.sessionId}
                className="border boa-rule rounded-sm flex flex-col"
                style={{ background: "rgba(245,241,234,0.5)", minHeight: 360 }}
              >
                <div className="px-4 py-3 border-b boa-rule">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/sessions/${c.sessionId}`}
                      className="boa-display text-[18px] leading-tight hover:text-[color:var(--boa-brass)] truncate"
                      style={{ color: "var(--boa-ink)" }}
                    >
                      {c.boardName}
                    </Link>
                    <StatusPill status={status} />
                  </div>
                  <div
                    className="boa-mono text-[10px] uppercase tracking-wider mt-1"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {c.contributionCount} contributions
                  </div>
                </div>
                <div className="px-4 py-3 flex-1 overflow-auto text-[13px] leading-relaxed">
                  {isLive ? (
                    <ul className="space-y-1.5">
                      {(live?.events ?? []).map((e, i) => (
                        <li
                          key={i}
                          className="flex gap-2 boa-mono text-[11px]"
                          style={{ color: "var(--boa-ink-2)" }}
                        >
                          <span style={{ color: "var(--boa-brass)" }}>›</span>
                          <span>{e.text}</span>
                        </li>
                      ))}
                      {status === "running" && (
                        <li
                          className="flex gap-2 boa-mono text-[11px] mt-2"
                          style={{ color: "var(--boa-ink-3)" }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full boa-pulse mt-1.5"
                            style={{ background: "var(--boa-brass)" }}
                          />
                          deliberating
                          <span className="boa-cursor" />
                        </li>
                      )}
                    </ul>
                  ) : (
                    <div
                      className="whitespace-pre-wrap"
                      style={{ color: "var(--boa-ink-2)" }}
                    >
                      {c.convergenceNote ||
                        c.finalSummary ||
                        (status === "running"
                          ? "Awaiting deliberation…"
                          : "No synthesis available.")}
                    </div>
                  )}
                </div>
                <div className="px-4 py-2 border-t boa-rule">
                  <Link
                    href={`/sessions/${c.sessionId}`}
                    className="boa-mono text-[10px] uppercase tracking-[0.18em] hover:underline"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    Open transcript →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Master synthesis */}
      <section className="mb-14">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.2em] font-bold mb-6 flex items-center gap-3"
          style={{ color: "var(--boa-brass)" }}
        >
          Master synthesis
          <span
            className="font-normal tracking-normal lowercase text-[10px] px-2 py-0.5 rounded-sm"
            style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-3)" }}
          >
            claude-opus-4-7
          </span>
          {synthStatus === "running" && (
            <span
              className="flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full boa-pulse"
                style={{ background: "var(--boa-brass)" }}
              />
              Cross-examining
            </span>
          )}
        </div>

        {!metaRecommendation && synthStatus !== "complete" && isLive ? (
          <div
            className="border boa-rule rounded-sm p-6 text-[13px]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Synthesis will arrive once every board has finished deliberating.
          </div>
        ) : !metaRecommendation && !data.crossExamination.completedAt ? (
          <div
            className="border boa-rule rounded-sm p-6 text-[13px]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Awaiting synthesis…
          </div>
        ) : (
          <>
            {/* Alignment matrix */}
            {alignmentMatrix.length > 0 && (
              <div className="mb-10">
                <h3
                  className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Alignment matrix
                </h3>
                <div
                  className="border boa-rule rounded-sm overflow-x-auto"
                  style={{ background: "rgba(245,241,234,0.5)" }}
                >
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr
                        className="border-b boa-rule"
                        style={{ background: "var(--boa-paper-2)" }}
                      >
                        <th
                          className="text-left px-4 py-2.5 boa-mono text-[10px] uppercase tracking-wider"
                          style={{ color: "var(--boa-ink-3)" }}
                        >
                          Topic
                        </th>
                        {boardOrder.map((bid) => {
                          const child = children.find((c) => c.boardId === bid);
                          return (
                            <th
                              key={bid}
                              className="text-left px-4 py-2.5 boa-mono text-[10px] uppercase tracking-wider"
                              style={{ color: "var(--boa-ink-3)" }}
                            >
                              {child?.boardName ?? "—"}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y boa-rule">
                      {alignmentMatrix.map((row: any, i: number) => (
                        <tr key={i}>
                          <td
                            className="px-4 py-3 align-top font-medium"
                            style={{ color: "var(--boa-ink)" }}
                          >
                            {row.topic}
                          </td>
                          {boardOrder.map((bid) => {
                            const v = (row.verdicts || []).find(
                              (x: any) => x.boardId === bid,
                            );
                            return (
                              <td
                                key={bid}
                                className="px-4 py-3 align-top text-[13px]"
                                style={{ color: "var(--boa-ink-2)" }}
                              >
                                {v?.stance ?? (
                                  <span
                                    className="boa-mono text-[10px]"
                                    style={{ color: "var(--boa-ink-3)" }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unique insights */}
            {uniqueInsights.length > 0 && (
              <div className="mb-10">
                <h3
                  className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Unique insights per board
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {uniqueInsights.map((u: any, i: number) => (
                    <div
                      key={i}
                      className="border boa-rule rounded-sm p-4"
                      style={{ background: "rgba(245,241,234,0.5)" }}
                    >
                      <div
                        className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-1.5"
                        style={{ color: "var(--boa-brass)" }}
                      >
                        {u.boardName}
                      </div>
                      <p
                        className="text-[14px] leading-relaxed"
                        style={{ color: "var(--boa-ink-2)" }}
                      >
                        {u.insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta recommendation */}
            {metaRecommendation && (
              <div className="mb-10">
                <h3
                  className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Meta-recommendation
                </h3>
                <div
                  className="border-l-4 pl-5 py-2 text-[16px] leading-relaxed italic max-w-3xl"
                  style={{
                    borderColor: "var(--boa-brass)",
                    color: "var(--boa-ink)",
                  }}
                >
                  {metaRecommendation}
                </div>
              </div>
            )}

            {/* Narrative */}
            {synthesisNarrative && (
              <div className="mb-6">
                <h3
                  className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Synthesis narrative
                </h3>
                <div
                  className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-3xl"
                  style={{ color: "var(--boa-ink-2)" }}
                >
                  {synthesisNarrative}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="mt-16 flex justify-between items-center pt-6 border-t boa-rule-strong">
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Quorum · Cross-examination
        </div>
        <button
          onClick={() => window.print()}
          className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors flex items-center gap-1.5"
          style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
        >
          <Printer className="w-3 h-3" />
          Print
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    running: { bg: "var(--boa-brass)", fg: "#1a1208", label: "Running" },
    complete: {
      bg: "var(--boa-vote-yes)",
      fg: "#fff",
      label: "Complete",
    },
    failed: { bg: "var(--boa-vote-no)", fg: "#fff", label: "Failed" },
  };
  const s = styles[status] ?? {
    bg: "var(--boa-paper-2)",
    fg: "var(--boa-ink-2)",
    label: status,
  };
  return (
    <span
      className="boa-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
