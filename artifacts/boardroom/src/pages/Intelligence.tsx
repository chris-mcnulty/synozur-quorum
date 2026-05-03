import { Link } from "wouter";
import {
  useGetTenantIntelligence,
  useBackfillTenantTopics,
  useListTenants,
  type TenantIntelligence,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Sparkles, TrendingUp, Scale, Tag } from "lucide-react";

export default function Intelligence({ tenantId }: { tenantId: string }) {
  const { data, isLoading, refetch } = useGetTenantIntelligence(tenantId);
  const { data: tenants } = useListTenants();
  const tenantName =
    tenants?.find((t) => t.tenant.id === tenantId)?.tenant.name ?? "Workspace";
  const backfill = useBackfillTenantTopics();
  const { toast } = useToast();

  const handleBackfill = async () => {
    try {
      const result = await backfill.mutateAsync({ tenantId, data: { limit: 10 } });
      toast({
        title: `Tagged ${result.processed} sessions`,
        description: `${result.remaining} remaining.`,
      });
      refetch();
    } catch (err) {
      toast({
        title: "Backfill failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !data) {
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <div className="h-8 w-64 bg-[color:var(--boa-paper-2)] animate-pulse rounded-sm mb-4" />
        <div className="h-4 w-96 bg-[color:var(--boa-paper-2)] animate-pulse rounded-sm" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10">
      <header className="mb-10">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          Council Intelligence · {tenantName}
        </div>
        <h1
          className="boa-display text-[42px] leading-tight"
          style={{ color: "var(--boa-ink)" }}
        >
          The shape of your council
        </h1>
        <p
          className="text-[14px] mt-2 max-w-2xl"
          style={{ color: "var(--boa-ink-2)" }}
        >
          Patterns across sessions, decisions, and outcomes — the analytical view
          of your workspace.
        </p>
      </header>

      <KpiStrip data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-12">
        <div className="lg:col-span-2 space-y-10">
          <Section title="Decision velocity" subtitle="Sessions per week — last 12 weeks">
            <Sparkline points={data.velocity.map((v) => v.count)} />
            <div className="flex justify-between mt-2 boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
              <span>{data.velocity[0]?.weekStart ?? ""}</span>
              <span>{data.velocity[data.velocity.length - 1]?.weekStart ?? ""}</span>
            </div>
          </Section>

          <Section
            title="Decision velocity"
            subtitle="Decisions recorded per week"
          >
            <Sparkline
              points={data.decisionVelocity.map((v) => v.count)}
              color="var(--boa-brass)"
            />
          </Section>

          <Section
            title="Topic heatmap"
            subtitle="What this council deliberates about most"
            action={
              data.untaggedSessionCount > 0 ? (
                <button
                  onClick={handleBackfill}
                  disabled={backfill.isPending}
                  className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
                  style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
                  data-testid="backfill-topics-btn"
                >
                  <Sparkles className="w-3 h-3" />
                  Tag {data.untaggedSessionCount} sessions
                </button>
              ) : null
            }
          >
            {data.topTopics.length === 0 ? (
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                No topics yet — tag sessions to populate.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.topTopics.map((t) => {
                  const max = data.topTopics[0].count || 1;
                  const intensity = 0.15 + 0.65 * (t.count / max);
                  return (
                    <span
                      key={t.topic}
                      className="px-2.5 py-1 rounded-sm boa-mono text-[11px] inline-flex items-center gap-1.5"
                      style={{
                        background: `rgba(196,106,42,${intensity.toFixed(2)})`,
                        color:
                          intensity > 0.45 ? "var(--boa-paper)" : "var(--boa-ink)",
                      }}
                    >
                      <Tag className="w-3 h-3" />
                      {t.topic}
                      <span className="opacity-70">×{t.count}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-10">
          <Section title="Win rate" subtitle="Outcomes recorded">
            <WinRateWidget data={data} />
          </Section>

          <Section title="Outcome breakdown">
            <ul className="space-y-2 text-[13px]">
              {(["WIN", "LOSS", "MIXED", "TOO_EARLY"] as const).map((tag) => {
                const count = data.tagCounts[tag] ?? 0;
                const total = Math.max(data.recordedOutcomes, 1);
                const pct = Math.round((count / total) * 100);
                return (
                  <li key={tag} className="flex items-center gap-3">
                    <span
                      className="boa-mono text-[10px] uppercase tracking-[0.18em] w-[80px]"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      {tag.replace("_", " ")}
                    </span>
                    <div className="flex-1 h-1 rounded-sm overflow-hidden" style={{ background: "var(--boa-paper-3)" }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background:
                            tag === "WIN"
                              ? "var(--boa-vote-yes, #2f6b3a)"
                              : tag === "LOSS"
                              ? "var(--boa-vote-no, #a23b3b)"
                              : tag === "MIXED"
                              ? "var(--boa-brass)"
                              : "var(--boa-ink-3)",
                        }}
                      />
                    </div>
                    <span className="boa-mono text-[11px] w-[40px] text-right">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Link href={`/t/${tenantId}/decisions`}>
            <button className="w-full inline-flex items-center justify-between boa-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
              style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                View decision ledger
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function KpiStrip({ data }: { data: TenantIntelligence }) {
  const winRatePct = data.recordedOutcomes
    ? Math.round(data.winRate * 100)
    : null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 border-y boa-rule">
      <Kpi label="Sessions" value={String(data.totalSessions)} />
      <Kpi label="Decisions" value={String(data.totalDecisions)} />
      <Kpi label="Resolved" value={String(data.decisionsResolved)} />
      <Kpi
        label="Win rate"
        value={winRatePct !== null ? `${winRatePct}%` : "—"}
      />
      <Kpi
        label="Avg / wk"
        value={String(
          Math.round(
            data.velocity.reduce((s, v) => s + v.count, 0) /
              Math.max(data.velocity.length, 1),
          ),
        )}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
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

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b boa-rule pb-2 mb-4">
        <div>
          <h2
            className="boa-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="text-[12px] mt-1"
              style={{ color: "var(--boa-ink-2)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Sparkline({
  points,
  color = "var(--boa-ink)",
  height = 48,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points, 1);
  const w = 100;
  const stride = w / Math.max(points.length - 1, 1);
  const path = points
    .map((p, i) => {
      const x = i * stride;
      const y = height - (p / max) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L ${w} ${height} L 0 ${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${height}px` }}
    >
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth={1} />
      {points.map((p, i) => {
        const x = i * stride;
        const y = height - (p / max) * (height - 4) - 2;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={p === max && p > 0 ? 1.6 : 0.9}
            fill={color}
          />
        );
      })}
    </svg>
  );
}

function WinRateWidget({ data }: { data: TenantIntelligence }) {
  if (data.recordedOutcomes === 0) {
    return (
      <div
        className="text-center py-6 boa-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "var(--boa-ink-3)" }}
      >
        No outcomes recorded yet
      </div>
    );
  }
  const pct = Math.round(data.winRate * 100);
  return (
    <div className="flex items-baseline gap-3">
      <div
        className="boa-display boa-num text-[56px] leading-none"
        style={{ color: "var(--boa-ink)" }}
      >
        {pct}%
      </div>
      <div className="boa-mono text-[10px] uppercase tracking-[0.18em] flex items-center gap-1" style={{ color: "var(--boa-ink-3)" }}>
        <TrendingUp className="w-3 h-3" />
        of {data.recordedOutcomes} resolved
      </div>
    </div>
  );
}
