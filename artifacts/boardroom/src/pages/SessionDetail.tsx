import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSession,
  useGetSessionLineage,
  useBranchSession,
  useListTenants,
  useListSessionGroundingSnapshots,
  useListSessionExports,
  getListSessionExportsQueryKey,
  SessionStatus,
  SessionMode,
  Vote,
  type SessionSummary,
  type SessionContribution,
} from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ExternalLink, GitBranch, Loader2, Printer, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SessionGroundedBy } from "@/components/SessionGroundedBy";
import { ShareExportMenu } from "@/components/ShareExportMenu";
import {
  PresenceStack,
  AnchorReactions,
  AnchorComments,
  FollowUpRail,
} from "@/components/SessionCollab";
import {
  citationAnchorId,
  findUncitedGroundedSpans,
  renderWithCitations,
  scrollToCitation,
  type CitationTarget,
} from "@/lib/citations";
import { AudioBriefingPanel } from "../components/AudioBriefingPanel";

interface FramingPhase {
  phase: "framing";
  chairsFraming?: string | null;
  establishedFactsText?: string | null;
}
interface MemberStartedPhase {
  phase: "member_started";
  memberName?: string | null;
}
interface MemberDonePhase {
  phase: "member_done";
  contribution: SessionContribution;
}
interface ConvergencePhase {
  phase: "convergence";
  convergenceNote?: string | null;
  openQuestionsText?: string | null;
  flagsRaisedText?: string | null;
  finalSummary?: string | null;
}
interface CompletePhase {
  phase: "complete" | "already_complete";
}

type StreamEvent =
  | FramingPhase
  | MemberStartedPhase
  | MemberDonePhase
  | ConvergencePhase
  | CompletePhase
  | { phase: "comment_added"; [k: string]: unknown }
  | { phase: "reaction_added"; [k: string]: unknown }
  | { phase: "reaction_removed"; [k: string]: unknown }
  | { phase: "follow_up_added"; [k: string]: unknown }
  | { phase: "follow_up_dispatched"; [k: string]: unknown }
  | { phase: "presence"; [k: string]: unknown };

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const { data: sessionData, isLoading, refetch } = useGetSession(sessionId);
  const { data: lineage } = useGetSessionLineage(sessionId);
  const { data: tenants } = useListTenants();
  const { data: snapshots } = useListSessionGroundingSnapshots(sessionId);
  const isComplete = sessionData?.session.status === SessionStatus.complete;
  const { data: exportsLog } = useListSessionExports(sessionId, {
    query: {
      refetchInterval: false,
      enabled: isComplete,
      queryKey: getListSessionExportsQueryKey(sessionId),
    },
  });
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeMember, setActiveMember] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState<
    | { mode: "session" }
    | { mode: "rewind"; contributionId: string; memberLabel: string }
    | null
  >(null);
  const [branchPrefill, setBranchPrefill] = useState<string>("");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const isLive = sessionData?.session.status === SessionStatus.running;
  const tenantId = sessionData?.board?.tenantId;
  const role = tenants?.find((t) => t.tenant.id === tenantId)?.role;
  const canDispatch = role === "OWNER" || role === "ADMIN" || role === "EDITOR";

  // Must be declared before any conditional returns to satisfy Rules of Hooks.
  const citationTargets = useMemo<Map<string, CitationTarget>>(() => {
    const map = new Map<string, CitationTarget>();
    for (const s of snapshots ?? []) {
      map.set(s.id, {
        snapshotId: s.id,
        label: s.selectorName,
        anchorId: citationAnchorId(s.id),
      });
    }
    return map;
  }, [snapshots]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`, {
      withCredentials: true,
    });

    eventSource.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as StreamEvent;
        switch (data.phase) {
          case "member_started":
            setActiveMember(data.memberName || null);
            return;
          case "member_done":
            setActiveMember(null);
            setStreamEvents((prev) => [...prev, data]);
            return;
          case "comment_added":
            qc.invalidateQueries({
              queryKey: ["/api/sessions", sessionId, "comments"],
            });
            return;
          case "reaction_added":
          case "reaction_removed":
            qc.invalidateQueries({
              queryKey: ["/api/sessions", sessionId, "reactions"],
            });
            return;
          case "follow_up_added":
          case "follow_up_dispatched":
            qc.invalidateQueries({
              queryKey: ["/api/sessions", sessionId, "follow-ups"],
            });
            return;
          case "presence":
            qc.invalidateQueries({
              queryKey: ["/api/sessions", sessionId, "presence"],
            });
            return;
          case "already_complete":
            setIsStreaming(false);
            setActiveMember(null);
            return;
          default:
            setStreamEvents((prev) => [...prev, data]);
        }
      } catch {}
    });
    eventSource.addEventListener("done", () => {
      setIsStreaming(false);
      setActiveMember(null);
      refetch();
      // Keep the SSE channel open so collab events still stream after the
      // session itself has finished running.
    });
    // Application-level error: the session run itself failed. Drop out of
    // live mode and refetch session state so the UI no longer shows a
    // streaming/running indicator.
    eventSource.addEventListener("error", (e) => {
      // Only treat events with a `data` payload as app-level errors.
      // Native EventSource transport errors fire on the same target with
      // no data; in that case let EventSource auto-reconnect.
      const me = e as MessageEvent;
      if (typeof me.data === "string" && me.data.length > 0) {
        setIsStreaming(false);
        setActiveMember(null);
        refetch();
      }
    });

    return () => eventSource.close();
    // Intentionally only depend on sessionId so the SSE connection persists
    // across the live -> completed transition without reconnecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Reflect session status into the streaming indicator without
  // re-creating the SSE connection.
  useEffect(() => {
    if (!isLive) {
      setIsStreaming(false);
      setActiveMember(null);
    } else {
      setIsStreaming(true);
    }
  }, [isLive]);

  if (isLoading)
    return (
      <div className="max-w-[1100px] mx-auto px-8 py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  if (!sessionData) return <div className="px-8 py-12">Session not found</div>;

  const { session, board, contributions, summary, establishedFactsText } = sessionData;
  const isBoardMode = session.mode === SessionMode.BOARD;

  const liveContributions: SessionContribution[] = streamEvents
    .filter((e): e is MemberDonePhase => e.phase === "member_done")
    .map((e) => e.contribution);

  // For rewound sessions, the server seeds inherited prior contributions
  // into the child row before streaming new ones. We merge the persisted
  // contributions (inherited) with what's streamed live so the user sees
  // the parent's earlier voices throughout the rerun, not just after it
  // finishes. We dedupe by id (live takes precedence on overlap).
  const displayContributions: SessionContribution[] = isLive
    ? (() => {
        const liveIds = new Set(liveContributions.map((c) => c.id));
        const inherited = contributions.filter((c) => !liveIds.has(c.id));
        return [...inherited, ...liveContributions];
      })()
    : contributions;

  const framingEvent = streamEvents.find(
    (e): e is FramingPhase => e.phase === "framing",
  );
  const convergenceEvent = streamEvents.find(
    (e): e is ConvergencePhase => e.phase === "convergence",
  );

  const framingText = isLive ? framingEvent?.chairsFraming : summary?.chairsFraming;
  const factsText = isLive ? framingEvent?.establishedFactsText : establishedFactsText;
  const convergenceText = isLive ? convergenceEvent?.convergenceNote : summary?.convergenceNote;
  const openQuestions = isLive ? convergenceEvent?.openQuestionsText : summary?.openQuestionsText;
  const flagsText = isLive ? convergenceEvent?.flagsRaisedText : summary?.flagsRaisedText;
  const suggestedBranches = summary?.suggestedBranches ?? [];

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
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/t/${board.tenantId}/boards/${board.id}`}
          className="inline-flex items-center text-[12px] boa-mono uppercase tracking-[0.15em] hover:underline"
          style={{ color: "var(--boa-ink-3)" }}
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Back to board
        </Link>
        <div className="flex items-center gap-2">
          {lineage && (lineage.children.length > 0 || lineage.siblings.length > 0 || lineage.parent) && (
            <button
              onClick={() => {
                const ids = [
                  sessionId,
                  ...(lineage.parent ? [lineage.parent.id] : []),
                  ...lineage.siblings.map((s) => s.id),
                  ...lineage.children.map((s) => s.id),
                ].slice(0, 4);
                setLocation(`/sessions/compare?ids=${ids.join(",")}`);
              }}
              className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
              data-testid="button-compare-lineage"
            >
              Compare lineage
            </button>
          )}
          {session.status === "complete" && (
            <button
              onClick={() => {
                setBranchPrefill("");
                setBranchOpen({ mode: "session" });
              }}
              className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors flex items-center gap-1.5"
              style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
              data-testid="button-branch-session"
            >
              <GitBranch className="w-3 h-3" />
              Branch this session
            </button>
          )}
        </div>
      </div>

      {/* Masthead */}
      <header className="mb-12 pb-8 border-b boa-rule-strong">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="boa-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Minutes — Session #{session.id.slice(0, 8)}
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
              {session.mode}
            </span>
            {lineage?.parent && (
              <LineagePill
                parent={lineage.parent}
                siblings={lineage.siblings}
                children={lineage.children}
                currentBranchNote={session.branchNote ?? null}
              />
            )}
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
              }}
              className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-sm border hover:bg-[color:var(--boa-paper-2)]"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
              title="Copy session viewer link"
            >
              Copy viewer link
            </button>
          </div>
          <PresenceStack sessionId={session.id} />
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

      {/* Grounded by */}
      <SessionGroundedBy sessionId={sessionId} />

      {/* Audio briefing — only when session complete */}
      {session.status === "complete" && (
        <SectionBlock title="Audio briefing" subtitle="podcast minutes">
          <AudioBriefingPanel sessionId={session.id} />
        </SectionBlock>
      )}

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
          <AnchorReactions sessionId={session.id} anchorType="framing" anchorId="" />
          <AnchorComments sessionId={session.id} anchorType="framing" anchorId="" canModerate={canDispatch} />
        </SectionBlock>
      )}

      {/* Failed state */}
      {session.status === "failed" && (
        <div
          className="py-12 flex flex-col items-center gap-4 border rounded-sm"
          style={{ borderColor: "rgba(196,106,42,0.4)", background: "rgba(196,106,42,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠</span>
            <span
              className="boa-mono text-[12px] uppercase tracking-[0.2em]"
              style={{ color: "var(--boa-flag)" }}
            >
              Session failed
            </span>
          </div>
          <p
            className="text-[13px] text-center max-w-sm leading-relaxed"
            style={{ color: "var(--boa-ink-3)" }}
          >
            The council could not complete deliberations — the AI service may be temporarily
            unavailable or the request timed out. Please try again from the board page.
          </p>
          <Link
            href={`/t/${board.tenantId}/boards/${board.id}`}
            className="boa-mono text-[11px] uppercase tracking-[0.15em] px-4 py-2 border rounded-sm hover:opacity-70 transition-opacity"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
          >
            Back to board
          </Link>
        </div>
      )}

      {/* Convening waiting state — shown while live but no events have arrived yet */}
      {isLive && streamEvents.length === 0 && (
        <div
          className="py-16 flex flex-col items-center gap-5 border rounded-sm"
          style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full boa-pulse"
              style={{ background: "var(--boa-brass)" }}
            />
            <span
              className="boa-mono text-[12px] uppercase tracking-[0.2em]"
              style={{ color: "var(--boa-brass)" }}
            >
              Board convening
            </span>
          </div>
          <p
            className="text-[13px] text-center max-w-xs leading-relaxed"
            style={{ color: "var(--boa-ink-3)" }}
          >
            The chair is framing the question. Advisor contributions will appear here as they are delivered.
          </p>
        </div>
      )}

      {/* Contributions */}
      <SectionBlock title={`Contributions (${displayContributions.length})`}>
        <div className="space-y-12">
          <AnimatePresence initial={false}>
            {displayContributions.map((c, i) => (
              <motion.div
                key={c.id}
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
                  {renderWithCitations(
                    c.contributionText || "",
                    citationTargets,
                    (t) => scrollToCitation(t.anchorId),
                  )}
                </div>
                {citationTargets.size > 0 &&
                  (() => {
                    const spans = findUncitedGroundedSpans(
                      c.contributionText || "",
                    );
                    if (spans.length === 0) return null;
                    return (
                      <div
                        className="mt-3 inline-flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded-sm"
                        style={{
                          background: "rgba(196,106,42,0.1)",
                          color: "var(--boa-flag)",
                          border: "1px solid rgba(196,106,42,0.3)",
                        }}
                        data-testid="warning-uncited-claim"
                        title={`${spans.length} grounded claim${spans.length === 1 ? "" : "s"} without a citation:\n\n${spans.slice(0, 3).join("\n\n")}`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {spans.length} uncited grounded claim
                        {spans.length === 1 ? "" : "s"}
                      </div>
                    );
                  })()}
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
                {session.status === "complete" && c.boardMemberId && (
                  <div className="mt-4">
                    <button
                      onClick={() =>
                        setBranchOpen({
                          mode: "rewind",
                          contributionId: c.id,
                          memberLabel: `${c.memberName ?? "Advisor"} — ${c.memberRoleTitle ?? ""}`,
                        })
                      }
                      className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors inline-flex items-center gap-1.5"
                      style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
                      data-testid={`button-rewind-${c.id}`}
                      title="Rewind from here — keep earlier voices, re-run from this advisor onward"
                    >
                      <GitBranch className="w-3 h-3" />
                      Rewind from here
                    </button>
                  </div>
                )}
                <AnchorReactions
                  sessionId={session.id}
                  anchorType="contribution"
                  anchorId={c.id}
                />
                <AnchorComments
                  sessionId={session.id}
                  anchorType="contribution"
                  anchorId={c.id}
                  canModerate={canDispatch}
                />
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
          <AnchorReactions sessionId={session.id} anchorType="convergence" anchorId="" />
          <AnchorComments sessionId={session.id} anchorType="convergence" anchorId="" canModerate={canDispatch} />
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

      {/* Suggested branches */}
      {session.status === "complete" && suggestedBranches.length > 0 && (
        <SectionBlock
          title="Suggested what-if branches"
          subtitle="claude-opus-4-7"
        >
          <div
            className="text-[13px] mb-3 max-w-3xl"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Variables the chair flagged as most likely to flip the council's
            reasoning. Click one to open a pre-filled branch.
          </div>
          <div className="flex flex-wrap gap-2 max-w-3xl">
            {suggestedBranches.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setBranchPrefill(s.prompt);
                  setBranchOpen({ mode: "session" });
                }}
                className="boa-mono text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors flex items-center gap-1.5"
                style={{
                  borderColor: "var(--boa-brass)",
                  color: "var(--boa-brass)",
                  background: "rgba(184,134,11,0.06)",
                }}
                title={s.prompt}
                data-testid={`chip-suggested-branch-${i}`}
              >
                <GitBranch className="w-3 h-3" />
                {s.label}
              </button>
            ))}
          </div>
        </SectionBlock>
      )}

      {/* Children lineage */}
      {lineage && lineage.children.length > 0 && (
        <SectionBlock title={`Branches from this session (${lineage.children.length})`}>
          <div className="space-y-2">
            {lineage.children.map((c) => (
              <Link key={c.id} href={`/sessions/${c.id}`}>
                <div
                  className="border boa-rule rounded-sm p-3 flex items-start gap-3 hover:bg-[color:var(--boa-paper-2)] transition-colors cursor-pointer"
                  data-testid={`link-child-${c.id}`}
                >
                  <GitBranch className="w-3.5 h-3.5 mt-1" style={{ color: "var(--boa-ink-3)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] italic line-clamp-1" style={{ color: "var(--boa-ink-2)" }}>
                      “{c.questionText}”
                    </div>
                    {c.branchNote && (
                      <div
                        className="boa-mono text-[10px] uppercase tracking-[0.15em] mt-1"
                        style={{ color: "var(--boa-ink-3)" }}
                      >
                        Δ {c.branchNote}
                      </div>
                    )}
                  </div>
                  <span
                    className="boa-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </SectionBlock>
      )}

      <FollowUpRail sessionId={session.id} canDispatch={canDispatch} />

      {isComplete && exportsLog && exportsLog.length > 0 && (
        <SectionBlock title="Export log">
          <ul className="text-[12px] divide-y boa-rule">
            {exportsLog.map((e) => (
              <li key={e.id} className="py-2 flex items-center justify-between">
                <span style={{ color: "var(--boa-ink-2)" }}>
                  <span
                    className="boa-mono text-[10px] uppercase tracking-wider mr-2"
                    style={{
                      color:
                        e.status === "succeeded"
                          ? "var(--boa-ink-3)"
                          : "var(--boa-vote-no)",
                    }}
                  >
                    {e.kind}
                  </span>
                  {e.target ?? "—"}
                  {e.exportedByName && (
                    <span style={{ color: "var(--boa-ink-3)" }}>
                      {" "}· by {e.exportedByName}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className="boa-mono text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                  {e.targetUrl && (
                    <a
                      href={e.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                      style={{ color: "var(--boa-brass)" }}
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </SectionBlock>
      )}

      <div className="mt-16 flex justify-between items-center pt-6 border-t boa-rule-strong">
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Quorum · Audit-grade transcript
        </div>
        {isComplete ? (
          <ShareExportMenu sessionId={sessionId} />
        ) : (
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Share / Export available once session completes
          </span>
        )}
      </div>

      {branchOpen && (
        <BranchModal
          key={branchPrefill || "blank"}
          parentSessionId={sessionId}
          parentQuestion={session.questionText}
          rewind={
            branchOpen.mode === "rewind"
              ? {
                  contributionId: branchOpen.contributionId,
                  memberLabel: branchOpen.memberLabel,
                }
              : null
          }
          initialBranchNote={branchPrefill}
          onClose={() => setBranchOpen(null)}
          onCreated={(newId) => {
            setBranchOpen(null);
            setLocation(`/sessions/${newId}`);
          }}
        />
      )}
    </div>
  );
}

function LineagePill({
  parent,
  siblings,
  children,
  currentBranchNote,
}: {
  parent: SessionSummary;
  siblings: SessionSummary[];
  children: SessionSummary[];
  currentBranchNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className="boa-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm flex items-center gap-1.5"
        style={{ background: "rgba(184,134,11,0.15)", color: "var(--boa-brass)" }}
        data-testid="pill-branched-from"
      >
        <GitBranch className="w-2.5 h-2.5" />
        Branched from #{parent.id.slice(0, 8)}
      </button>
      {open && (
        <div
          className="absolute z-20 left-0 top-full mt-2 w-[360px] border boa-rule rounded-sm shadow-lg p-4"
          style={{ background: "var(--boa-paper)" }}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Lineage
          </div>
          <Link href={`/sessions/${parent.id}`}>
            <div className="text-[12px] italic line-clamp-2 mb-1 hover:underline cursor-pointer" style={{ color: "var(--boa-ink)" }}>
              ↑ “{parent.questionText}”
            </div>
          </Link>
          {currentBranchNote && (
            <div className="text-[11px] mb-2 boa-mono" style={{ color: "var(--boa-brass)" }}>
              Δ {currentBranchNote}
            </div>
          )}
          {siblings.length > 0 && (
            <>
              <div className="boa-mono text-[9px] uppercase tracking-wider mt-3 mb-1" style={{ color: "var(--boa-ink-3)" }}>
                Siblings
              </div>
              {siblings.map((s) => (
                <Link key={s.id} href={`/sessions/${s.id}`}>
                  <div className="text-[11px] line-clamp-1 hover:underline cursor-pointer" style={{ color: "var(--boa-ink-2)" }}>
                    · {s.branchNote || s.questionText}
                  </div>
                </Link>
              ))}
            </>
          )}
          {children.length > 0 && (
            <>
              <div className="boa-mono text-[9px] uppercase tracking-wider mt-3 mb-1" style={{ color: "var(--boa-ink-3)" }}>
                Children
              </div>
              {children.map((s) => (
                <Link key={s.id} href={`/sessions/${s.id}`}>
                  <div className="text-[11px] line-clamp-1 hover:underline cursor-pointer" style={{ color: "var(--boa-ink-2)" }}>
                    · {s.branchNote || s.questionText}
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BranchModal({
  parentSessionId,
  parentQuestion,
  rewind,
  initialBranchNote,
  onClose,
  onCreated,
}: {
  parentSessionId: string;
  parentQuestion: string;
  rewind: { contributionId: string; memberLabel: string } | null;
  initialBranchNote?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [questionText, setQuestionText] = useState(parentQuestion);
  const [branchNote, setBranchNote] = useState(initialBranchNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const isRewind = rewind !== null;
  const branchMutation = useBranchSession({
    mutation: {
      onSuccess: (data) => {
        onCreated(data.id);
      },
      onError: (err: unknown) => {
        const e = err as { message?: string };
        setError(e?.message ?? "Failed to branch session");
      },
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!questionText.trim() || !branchNote.trim()) {
      setError("Question and change description are required.");
      return;
    }
    branchMutation.mutate({
      sessionId: parentSessionId,
      data: {
        questionText: questionText.trim(),
        branchNote: branchNote.trim(),
        ...(rewind ? { fromContributionId: rewind.contributionId } : {}),
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,20,26,0.55)" }}
      data-testid="modal-branch-session"
    >
      <div
        className="w-full max-w-[600px] border boa-rule rounded-sm shadow-2xl"
        style={{ background: "var(--boa-paper)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b boa-rule">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" style={{ color: "var(--boa-brass)" }} />
            <h3 className="boa-display text-[20px]" style={{ color: "var(--boa-ink)" }}>
              {isRewind ? "Rewind from this advisor" : "Branch this session"}
            </h3>
          </div>
          <button onClick={onClose} className="hover:opacity-60" data-testid="button-close-branch">
            <X className="w-4 h-4" style={{ color: "var(--boa-ink-3)" }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {isRewind && rewind && (
            <div
              className="border boa-rule rounded-sm p-3 text-[12px]"
              style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
              data-testid="text-rewind-context"
            >
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-1"
                style={{ color: "var(--boa-brass)" }}
              >
                Rewind point
              </div>
              <div>
                Earlier voices in this session will be inherited verbatim. Only{" "}
                <strong>{rewind.memberLabel}</strong> and any later advisors will be re-run
                under the variable below.
              </div>
            </div>
          )}
          <div>
            <label
              className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
              style={{ color: "var(--boa-ink-3)" }}
            >
              {isRewind
                ? "Question (kept from parent unless you change it)"
                : "Question (rerun with this prompt)"}
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="w-full text-[14px] p-3 border boa-rule rounded-sm bg-[color:var(--boa-paper)] focus:outline-none focus:ring-1"
              data-testid="input-branch-question"
            />
          </div>
          <div>
            <label
              className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
              style={{ color: "var(--boa-ink-3)" }}
            >
              What changes? (the council will be told)
            </label>
            <textarea
              value={branchNote}
              onChange={(e) => setBranchNote(e.target.value)}
              rows={2}
              placeholder="e.g. We have half the budget. Or: Assume regulator approves in 6 weeks."
              className="w-full text-[14px] p-3 border boa-rule rounded-sm bg-[color:var(--boa-paper)] focus:outline-none focus:ring-1"
              data-testid="input-branch-note"
            />
          </div>
          {error && (
            <div className="text-[12px]" style={{ color: "var(--boa-vote-no)" }}>
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t boa-rule">
          <button
            onClick={onClose}
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 border rounded-sm"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={branchMutation.isPending}
            className="boa-cta boa-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 rounded-sm disabled:opacity-50 flex items-center gap-1.5"
            data-testid="button-submit-branch"
          >
            {branchMutation.isPending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Convening…
              </>
            ) : (
              <>
                <GitBranch className="w-3 h-3" />
                {isRewind ? "Rewind & re-run" : "Branch & convene"}
              </>
            )}
          </button>
        </div>
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
