import { useListBoards } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Boards({ tenantId }: { tenantId: string }) {
  const { data: boards, isLoading } = useListBoards(tenantId);

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10">
      <header className="mb-10 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="boa-display text-[42px] leading-tight mb-2" style={{ color: "var(--boa-ink)" }}>
            Boards of advisors
          </h1>
          <div
            className="boa-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            {boards?.length ?? 0} BOARDS CONVENED
          </div>
        </div>
        <Link href={`/t/${tenantId}/boards/new`}>
          <button className="boa-cta px-3.5 py-2 rounded-sm text-[12.5px] flex items-center gap-1.5 transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" />
            New board
          </button>
        </Link>
      </header>

      {isLoading ? (
        <div className="boa-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--boa-ink-3)" }}>
          Loading…
        </div>
      ) : !boards?.length ? (
        <div
          className="border boa-rule rounded-sm p-12 text-center"
          style={{ color: "var(--boa-ink-3)" }}
        >
          <div className="boa-display text-[22px] mb-2" style={{ color: "var(--boa-ink)" }}>
            No boards yet
          </div>
          <p className="text-[14px] mb-6">Create your first board of advisors to start convening sessions.</p>
          <Link href={`/t/${tenantId}/boards/new`}>
            <button className="boa-cta px-4 py-2 rounded-sm text-[13px] font-medium inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create board
            </button>
          </Link>
        </div>
      ) : (
        <div className="border-t border-b boa-rule-strong divide-y boa-rule">
          {boards.map((b) => (
            <Link key={b.id} href={`/t/${tenantId}/boards/${b.id}`}>
              <div className="py-5 flex items-center gap-6 hover:bg-[rgba(20,20,26,0.02)] transition-colors cursor-pointer group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
                    <h2
                      className="boa-display text-[22px] group-hover:text-[color:var(--boa-brass)] transition-colors truncate"
                      style={{ color: "var(--boa-ink)" }}
                    >
                      {b.name}
                    </h2>
                    {b.topicArea && (
                      <span
                        className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                        style={{ color: "var(--boa-ink-3)" }}
                      >
                        {b.topicArea}
                      </span>
                    )}
                  </div>
                  {b.description && (
                    <p
                      className="text-[13px] line-clamp-2 max-w-2xl"
                      style={{ color: "var(--boa-ink-2)" }}
                    >
                      {b.description}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="boa-display boa-num text-[20px]" style={{ color: "var(--boa-ink)" }}>
                    {b.memberCount}/{b.size}
                  </div>
                  <div className="boa-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--boa-ink-3)" }}>
                    advisors
                  </div>
                </div>
                <div className="text-right shrink-0 w-[120px] hidden md:block">
                  <div className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                    {b.lastSessionAt
                      ? `last ${formatDistanceToNow(new Date(b.lastSessionAt))}`
                      : "no sessions"}
                  </div>
                </div>
                <ChevronRight
                  className="w-4 h-4 shrink-0 group-hover:text-[color:var(--boa-brass)] transition-colors"
                  style={{ color: "var(--boa-paper-3)" }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
