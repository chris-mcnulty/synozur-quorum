import { useGetTenantDashboard, useListTenants } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { ArrowRight, GitBranch, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard({ tenantId }: { tenantId: string }) {
  const { data: dashboard, isLoading } = useGetTenantDashboard(tenantId);
  const { data: tenants } = useListTenants();
  const tenantName = tenants?.find((t) => t.tenant.id === tenantId)?.tenant.name || "Workspace";
  const [, setLocation] = useLocation();

  if (isLoading) {
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
        <h1 className="boa-display text-[42px] leading-tight mb-2" style={{ color: "var(--boa-ink)" }}>
          {tenantName}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="boa-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            {dashboard?.boardCount ?? 0} BOARDS · {dashboard?.sessionCount ?? 0} SESSIONS · {dashboard?.memberCount ?? 0} ADVISORS
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 border-y boa-rule mb-12">
        <KpiTile label="Active boards" value={String(dashboard?.boardCount ?? 0)} className="border-r boa-rule" />
        <KpiTile label="Total sessions" value={String(dashboard?.sessionCount ?? 0)} className="border-r boa-rule" />
        <KpiTile label="Advisors" value={String(dashboard?.memberCount ?? 0)} className="md:border-r boa-rule" />
        <KpiTile
          label="Convene"
          value="↗"
          action
          onClick={() => setLocation(`/t/${tenantId}/boards`)}
        />
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-12">
        <div className="flex-[3] w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="boa-display text-[22px]">Recent council activity</h2>
            <Link
              href={`/t/${tenantId}/boards`}
              className="text-[12px] flex items-center gap-1 hover:underline"
              style={{ color: "var(--boa-ink-3)" }}
            >
              View boards <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {dashboard?.recentSessions?.length ? (
            <div className="border-t border-b boa-rule-strong divide-y boa-rule">
              {(() => {
                // Order so children appear immediately after their visible parent.
                const list = dashboard.recentSessions;
                const idSet = new Set(list.map((s) => s.id));
                const childrenByParent = new Map<string, typeof list>();
                const roots: typeof list = [];
                for (const s of list) {
                  if (s.parentSessionId && idSet.has(s.parentSessionId)) {
                    const arr = childrenByParent.get(s.parentSessionId) ?? [];
                    arr.push(s);
                    childrenByParent.set(s.parentSessionId, arr);
                  } else {
                    roots.push(s);
                  }
                }
                const ordered: Array<{ s: typeof list[number]; depth: number }> = [];
                const walk = (node: typeof list[number], depth: number) => {
                  ordered.push({ s: node, depth });
                  const kids = childrenByParent.get(node.id) ?? [];
                  for (const k of kids) walk(k, depth + 1);
                };
                for (const r of roots) walk(r, 0);

                return ordered.map(({ s, depth }) => (
                  <Link key={s.id} href={`/sessions/${s.id}`}>
                    <div
                      className="py-3 flex items-start gap-4 hover:bg-[rgba(20,20,26,0.02)] transition-colors cursor-pointer"
                      style={{ paddingLeft: depth * 24 }}
                      data-testid={`session-row-${s.id}`}
                    >
                      <div className="w-[60px] shrink-0 pt-0.5 flex items-center gap-1">
                        {depth > 0 && (
                          <GitBranch
                            className="w-3 h-3"
                            style={{ color: "var(--boa-brass)" }}
                          />
                        )}
                        <div className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                          {formatDistanceToNow(new Date(s.startedAt), { addSuffix: false })}
                        </div>
                      </div>
                      <div className="w-[120px] shrink-0 pt-0.5">
                        <div
                          className="boa-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-block"
                          style={{ background: "rgba(20,20,26,0.04)", color: "var(--boa-ink-2)" }}
                        >
                          {s.mode}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[14px] italic leading-snug line-clamp-2"
                          style={{ color: "var(--boa-ink-2)" }}
                        >
                          “{s.questionText}”
                        </div>
                        {s.branchNote && (
                          <div
                            className="boa-mono text-[10px] uppercase tracking-[0.15em] mt-1"
                            style={{ color: "var(--boa-brass)" }}
                          >
                            Δ {s.branchNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ));
              })()}
            </div>
          ) : (
            <div
              className="border boa-rule rounded-sm p-8 text-center"
              style={{ color: "var(--boa-ink-3)" }}
            >
              <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2">
                No sessions convened
              </div>
              <p className="text-[13px]">Create a board and convene to populate the ledger.</p>
            </div>
          )}
        </div>

        <div className="flex-[2] w-full space-y-10">
          <section>
            <h3
              className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-4 flex items-center justify-between"
              style={{ color: "var(--boa-ink-3)" }}
            >
              <span>Top boards</span>
              <Link
                href={`/t/${tenantId}/boards`}
                className="hover:underline cursor-pointer"
              >
                View all
              </Link>
            </h3>
            <div className="space-y-2 text-[13px]">
              {dashboard?.topBoards?.length ? (
                dashboard.topBoards.map((b) => (
                  <Link key={b.id} href={`/t/${tenantId}/boards/${b.id}`}>
                    <div className="flex items-baseline w-full group cursor-pointer">
                      <span className="font-medium group-hover:text-[color:var(--boa-brass)] transition-colors">
                        {b.name}
                      </span>
                      <span
                        className="flex-1 mx-2 overflow-hidden whitespace-nowrap"
                        style={{ color: "var(--boa-paper-3)" }}
                        aria-hidden="true"
                      >
                        ......................................................................................................................
                      </span>
                      <span className="boa-mono text-[11px]">{b.memberCount}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                  No boards yet.
                </div>
              )}
            </div>
            <Link href={`/t/${tenantId}/boards/new`}>
              <button
                className="mt-6 inline-flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
                style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
              >
                <Plus className="w-3 h-3" /> New board
              </button>
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  className = "",
  action,
  onClick,
}: {
  label: string;
  value: string;
  className?: string;
  action?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!action}
      className={`p-5 pl-0 first:pl-2 flex flex-col items-start text-left ${className} ${
        action ? "hover:bg-[rgba(20,20,26,0.02)] transition-colors cursor-pointer" : "cursor-default"
      }`}
    >
      <div
        className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-3"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-3">
        <div className="boa-display boa-num text-[32px] leading-none">{value}</div>
      </div>
    </button>
  );
}
