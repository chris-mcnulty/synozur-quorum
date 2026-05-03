import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetSession, SessionStatus, SessionMode, Vote } from "@workspace/api-client-react";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StreamEvent {
  phase: "framing" | "member_started" | "member_done" | "convergence" | "complete";
  memberName?: string;
  memberRoleTitle?: string;
  contributionText?: string;
  vote?: Vote;
  establishedFactsText?: string;
  chairsFraming?: string;
  convergenceNote?: string;
  finalSummary?: string;
  openQuestionsText?: string;
  flagsRaisedText?: string;
  voteTable?: any[];
}

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const { data: sessionData, isLoading, refetch } = useGetSession(sessionId);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeMember, setActiveMember] = useState<string | null>(null);

  const isLive = sessionData?.session.status === SessionStatus.running;

  useEffect(() => {
    if (!isLive) return;
    setIsStreaming(true);
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`, {
      withCredentials: true,
    });

    eventSource.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as StreamEvent;
        if (data.phase === "member_started") {
          setActiveMember(data.memberName || null);
        } else if (data.phase === "member_done") {
          setActiveMember(null);
          setStreamEvents((prev) => [...prev, data]);
        } else {
          setStreamEvents((prev) => [...prev, data]);
        }
      } catch {}
    });
    eventSource.addEventListener("done", () => {
      setIsStreaming(false);
      setActiveMember(null);
      eventSource.close();
      refetch();
    });
    eventSource.addEventListener("error", () => {
      setIsStreaming(false);
      setActiveMember(null);
      eventSource.close();
      refetch();
    });

    return () => eventSource.close();
  }, [sessionId, isLive, refetch]);

  if (isLoading)
    return (
      <div className="max-w-[1100px] mx-auto px-8 py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  if (!sessionData) return <div className="px-8 py-12">Session not found</div>;

  const { session, board, contributions, summary, establishedFactsText } = sessionData;
  const isBoardMode = session.mode === SessionMode.BOARD;

  const displayContributions = isLive
    ? streamEvents.filter((e) => e.phase === "member_done")
    : contributions;

  const framingEvent = streamEvents.find((e) => e.phase === "framing");
  const convergenceEvent = streamEvents.find((e) => e.phase === "convergence");

  const framingText = isLive ? framingEvent?.chairsFraming : summary?.chairsFraming;
  const factsText = isLive ? framingEvent?.establishedFactsText : establishedFactsText;
  const convergenceText = isLive ? convergenceEvent?.convergenceNote : summary?.convergenceNote;
  const openQuestions = isLive ? convergenceEvent?.openQuestionsText : summary?.openQuestionsText;
  const flagsText = isLive ? convergenceEvent?.flagsRaisedText : summary?.flagsRaisedText;

  const yesCount = displayContributions.filter((c) => c.vote === "YES").length;
  const noCount = displayContributions.filter((c) => c.vote === "NO").length;
  const abstainCount = displayContributions.filter((c) => c.vote === "ABSTAIN").length;

  const voteColor = (v?: Vote | null) =>
    v === "YES"
      ? "var(--boa-vote-yes)"
      : v === "NO"
      ? "var(--boa-vote-no)"
      : "var(--boa-vote-abs)";

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-12 pb-32">
      <Link
        href={`/t/${board.tenantId}/boards/${board.id}`}
        className="inline-flex items-center text-[12px] mb-6 boa-mono uppercase tracking-[0.15em] hover:underline"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Back to board
      </Link>

      {/* Masthead */}
      <header className="mb-12 pb-8 border-b boa-rule-strong">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="boa-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Minutes — Session #{session.id.slice(0, 8)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-brass)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full boa-pulse" style={{ background: "var(--boa-brass)" }} />
              Live
            </span>
          )}
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm"
            style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
          >
            {session.mode}
          </span>
        </div>
        <h1
          className="boa-display text-[40px] leading-[1.15] italic mb-6"
          style={{ color: "var(--boa-ink)" }}
        >
          “{session.questionText}”
        </h1>
        <div
          className="border boa-rule p-4 rounded-sm flex flex-wrap gap-x-6 gap-y-2 boa-mono text-[11px]"
          style={{ background: "rgba(245,241,234,0.5)", color: "var(--boa-ink-2)" }}
        >
          <Meta label="Board" value={board.name} />
          <Meta label="Status" value={session.status} />
          <Meta
            label="Convened"
            value={new Date(session.startedAt).toLocaleString()}
          />
          {session.completedAt && (
            <Meta
              label="Completed"
              value={new Date(session.completedAt).toLocaleString()}
            />
          )}
          <Meta label="Master" value="claude-opus-4-7" />
          <Meta label="Member" value="claude-sonnet-4-6" />
          {typeof session.totalCostCents === "number" && (
            <Meta label="Cost" value={`$${(session.totalCostCents / 100).toFixed(4)}`} />
          )}
        </div>
      </header>

      {/* Established facts */}
      {factsText && (
        <SectionBlock title="Established facts">
          <div
            className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-3xl"
            style={{ color: "var(--boa-ink-2)" }}
          >
            {factsText}
          </div>
        </SectionBlock>
      )}

      {/* Chair's framing */}
      {framingText && (
        <SectionBlock title="Chair's framing" subtitle="claude-opus-4-7">
          <div
            className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-3xl"
            style={{ color: "var(--boa-ink-2)" }}
          >
            {framingText}
          </div>
        </SectionBlock>
      )}

      {/* Contributions */}
      <SectionBlock title={`Contributions (${displayContributions.length})`}>
        <div className="space-y-12">
          <AnimatePresence initial={false}>
            {displayContributions.map((c, i) => (
              <motion.div
                key={(c as any).id || i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={i > 0 ? "pt-8 border-t boa-rule" : ""}
              >
                <h3
                  className="boa-display text-[22px] font-semibold mb-1"
                  style={{ color: "var(--boa-ink)" }}
                >
                  {c.memberName || "Advisor"}{" "}
                  <span
                    className="text-[16px] italic font-normal"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    — {c.memberRoleTitle}
                  </span>
                </h3>
                <div
                  className="boa-mono text-[10px] uppercase tracking-wider mb-4"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  claude-sonnet-4-6
                </div>
                <div
                  className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-3xl"
                  style={{ color: "var(--boa-ink-2)" }}
                >
                  {c.contributionText || ""}
                </div>
                {isBoardMode && c.vote && (
                  <div className="mt-5 inline-flex items-center gap-2">
                    <span
                      className="boa-mono text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-sm"
                      style={{ background: voteColor(c.vote), color: "#fff" }}
                    >
                      VOTE: {c.vote}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {activeMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-8 border-t boa-rule"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full boa-pulse"
                  style={{ background: "var(--boa-brass)" }}
                />
                <div
                  className="boa-mono text-[11px] uppercase tracking-[0.15em]"
                  style={{ color: "var(--boa-brass)" }}
                >
                  {activeMember} deliberating
                  <span className="boa-cursor"></span>
                </div>
              </div>
            </motion.div>
          )}

          {isStreaming && !activeMember && (
            <div className="pt-8 border-t boa-rule flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full boa-pulse"
                style={{ background: "var(--boa-brass)" }}
              />
              <div
                className="boa-mono text-[11px] uppercase tracking-[0.15em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Master synthesizing divergence…
              </div>
            </div>
          )}
        </div>
      </SectionBlock>

      {/* Vote tally */}
      {isBoardMode && (
        <SectionBlock title="Vote tally">
          <div
            className="border boa-rule rounded-sm overflow-hidden"
            style={{ background: "rgba(245,241,234,0.5)" }}
          >
            <div
              className="grid grid-cols-3 text-center divide-x boa-rule p-6"
            >
              <Tally label="Yes" value={yesCount} color="var(--boa-vote-yes)" />
              <Tally label="No" value={noCount} color="var(--boa-vote-no)" />
              <Tally label="Abstain" value={abstainCount} color="var(--boa-vote-abs)" />
            </div>
            <div className="border-t boa-rule divide-y boa-rule">
              {displayContributions.map((c, i) => (
                <div key={i} className="px-6 py-2 flex justify-between items-center text-[13px]">
                  <span>{c.memberName}</span>
                  <span
                    className="boa-mono text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: voteColor(c.vote) }}
                  >
                    {c.vote || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionBlock>
      )}

      {/* Convergence */}
      {convergenceText && (
        <section className="mb-12 relative">
          <div
            className="boa-mono text-[11px] uppercase tracking-[0.2em] font-bold mb-6 flex items-center gap-3"
            style={{ color: "var(--boa-brass)" }}
          >
            Convergence note (Master)
            <span
              className="font-normal tracking-normal lowercase text-[10px] px-2 py-0.5 rounded-sm"
              style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-3)" }}
            >
              claude-opus-4-7
            </span>
          </div>
          <div
            className="text-[16px] leading-relaxed whitespace-pre-wrap max-w-3xl"
            style={{ color: "var(--boa-ink)" }}
          >
            {convergenceText}
          </div>
        </section>
      )}

      {/* Open questions */}
      {openQuestions && (
        <SectionBlock title="Open questions">
          <div
            className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-3xl"
            style={{ color: "var(--boa-ink-2)" }}
          >
            {openQuestions}
          </div>
        </SectionBlock>
      )}

      {/* Flags */}
      {flagsText && (
        <SectionBlock title="Flags raised">
          <div
            className="border boa-rule rounded-sm p-4 boa-mono text-[12px] leading-relaxed whitespace-pre-wrap"
            style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
          >
            {flagsText}
          </div>
        </SectionBlock>
      )}

      <div className="mt-16 flex justify-between items-center pt-6 border-t boa-rule-strong">
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Quorum · Audit-grade transcript
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

function SectionBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2
        className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-6 pb-2 border-b boa-rule flex items-center gap-3"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {title}
        {subtitle && (
          <span
            className="font-normal tracking-normal lowercase text-[10px] px-2 py-0.5 rounded-sm"
            style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-3)" }}
          >
            {subtitle}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "var(--boa-ink-3)" }} className="mr-2">
        {label}
      </span>
      {value}
    </div>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="boa-display boa-num text-[36px]" style={{ color }}>
        {value}
      </div>
      <div
        className="boa-mono text-[10px] uppercase tracking-wider"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </div>
    </div>
  );
}
