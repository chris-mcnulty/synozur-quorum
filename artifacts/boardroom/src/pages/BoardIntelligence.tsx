import { Link } from "wouter";
import { useGetBoardIntelligence } from "@workspace/api-client-react";
import { Section, Sparkline } from "./Intelligence";
import { Sliders, AlertCircle, TrendingDown } from "lucide-react";

export default function BoardIntelligence({
  tenantId,
  boardId,
}: {
  tenantId: string;
  boardId: string;
}) {
  const { data, isLoading } = useGetBoardIntelligence(boardId);

  if (isLoading || !data) {
    return (
      <div className="py-6">
        <div className="h-4 w-48 bg-[color:var(--boa-paper-2)] animate-pulse rounded-sm" />
      </div>
    );
  }

  if (data.sessionCount === 0) {
    return (
      <div
        className="border boa-rule rounded-sm p-10 text-center"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2">
          No sessions to analyze
        </div>
        <p className="text-[13px]">
          Convene your first session and intelligence metrics will populate.
        </p>
      </div>
    );
  }

  const unanimityPct = Math.round(data.unanimityRate * 100);
  const flipPct = Math.round(data.voteFlipRate * 100);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 border-y boa-rule">
        <BoardKpi label="Sessions" value={String(data.sessionCount)} />
        <BoardKpi label="Unanimity" value={`${unanimityPct}%`} />
        <BoardKpi label="Vote-flip rate" value={`${flipPct}%`} />
        <BoardKpi label="Avg words" value={String(data.overallAvgWords)} />
      </div>

      <Section title="Per-advisor cards" subtitle="Recent contributions and confidence trend">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.perAdvisor.map((a) => {
            const isLongest = data.longestDeliberatorMemberId === a.memberId;
            const isShortest = data.shortestDeliberatorMemberId === a.memberId;
            const isAnomalous = data.anomalousMemberIds.includes(a.memberId);
            return (
              <div
                key={a.memberId}
                className="border boa-rule rounded-sm p-4"
                style={{ background: "var(--boa-paper)" }}
                data-testid={`advisor-card-${a.memberId}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="boa-display text-[16px]" style={{ color: "var(--boa-ink)" }}>
                      {a.name}
                    </div>
                    <div
                      className="boa-mono text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      {a.roleTitle}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isLongest && (
                      <Badge label="Longest" />
                    )}
                    {isShortest && (
                      <Badge label="Shortest" />
                    )}
                    {isAnomalous && (
                      <Badge label="Anomalous" tone="warn" />
                    )}
                  </div>
                </div>
                {a.lensDescription && (
                  <p
                    className="text-[12px] italic mb-3"
                    style={{ color: "var(--boa-ink-2)" }}
                  >
                    "{a.lensDescription}"
                  </p>
                )}
                <div className="flex items-center gap-4 boa-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "var(--boa-ink-3)" }}>
                  <span>{a.contributionCount} contribs</span>
                  <span>{a.avgWords}w avg</span>
                  <span>{a.voteYes}Y · {a.voteNo}N · {a.voteAbstain}A</span>
                </div>
                {a.trend.length > 1 && (
                  <Sparkline points={a.trend.map((t) => t.words)} height={32} />
                )}
                {isAnomalous && (
                  <Link href={`/t/${tenantId}/boards/${boardId}/members/${a.memberId}?retune=1`}>
                    <button
                      className="mt-3 inline-flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors w-full justify-center"
                      style={{ borderColor: "var(--boa-brass)", color: "var(--boa-brass)" }}
                      data-testid={`retune-cta-${a.memberId}`}
                    >
                      <Sliders className="w-3 h-3" />
                      Retune this advisor
                    </button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <Section title="Dissent leaderboard" subtitle="Advisors who most often vote against the majority">
          {data.dissentLeaders.length === 0 ? (
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              No dissent recorded yet.
            </div>
          ) : (
            <ol className="space-y-2">
              {data.dissentLeaders.map((d, idx) => (
                <li
                  key={d.memberId}
                  className="flex items-center gap-3 py-2 border-b boa-rule last:border-0"
                >
                  <span
                    className="boa-mono text-[10px] w-5"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate" style={{ color: "var(--boa-ink)" }}>
                      {d.name}
                    </div>
                    <div
                      className="boa-mono text-[10px] uppercase tracking-wider truncate"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      {d.roleTitle}
                    </div>
                  </div>
                  <span className="boa-mono text-[11px] inline-flex items-center gap-1" style={{ color: "var(--boa-brass)" }}>
                    <TrendingDown className="w-3 h-3" />
                    {d.dissentCount}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Vote-flip rate" subtitle="Decisions where the action diverged from the majority vote">
          <div className="flex items-baseline gap-3">
            <div
              className="boa-display boa-num text-[56px] leading-none"
              style={{ color: flipPct > 25 ? "var(--boa-brass)" : "var(--boa-ink)" }}
            >
              {flipPct}%
            </div>
            <div className="boa-mono text-[10px] uppercase tracking-[0.18em] flex items-center gap-1" style={{ color: "var(--boa-ink-3)" }}>
              <AlertCircle className="w-3 h-3" />
              of decisions diverged
            </div>
          </div>
          <p className="text-[12px] mt-3" style={{ color: "var(--boa-ink-2)" }}>
            High flip rates suggest the council's vote often doesn't reflect the
            ultimate action — review your master instructions and member lenses.
          </p>
        </Section>
      </div>
    </div>
  );
}

function BoardKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5 border-r last:border-r-0 boa-rule">
      <div
        className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-3"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </div>
      <div className="boa-display boa-num text-[28px] leading-none">{value}</div>
    </div>
  );
}

function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "warn" }) {
  return (
    <span
      className="boa-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm whitespace-nowrap"
      style={
        tone === "warn"
          ? { background: "rgba(196,106,42,0.15)", color: "var(--boa-brass)" }
          : { background: "var(--boa-paper-2)", color: "var(--boa-ink-3)" }
      }
    >
      {label}
    </span>
  );
}
