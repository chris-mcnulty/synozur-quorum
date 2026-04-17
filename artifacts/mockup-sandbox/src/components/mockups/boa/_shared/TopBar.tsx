import { Search, Command, Bell, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  crumbs?: { label: string; href?: string }[];
  rightSlot?: ReactNode;
};

export function TopBar({ crumbs = [], rightSlot }: Props) {
  return (
    <div
      className="h-[56px] shrink-0 flex items-center justify-between px-6 border-b"
      style={{ borderColor: "var(--boa-paper-3)", background: "#fbf8f1" }}
    >
      <nav className="flex items-center gap-1.5 text-[12.5px] min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            <span
              className={
                i === crumbs.length - 1
                  ? "truncate"
                  : "truncate text-[color:var(--boa-ink-3)]"
              }
              style={i === crumbs.length - 1 ? { color: "var(--boa-ink)" } : undefined}
            >
              {c.label}
            </span>
            {i < crumbs.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[color:var(--boa-ink-3)]" />
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <div
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-sm border w-[280px]"
          style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
        >
          <Search className="w-3.5 h-3.5 text-[color:var(--boa-ink-3)]" />
          <span className="text-[12px] text-[color:var(--boa-ink-3)] flex-1">
            Search boards, members, sessions…
          </span>
          <span
            className="boa-mono text-[10px] flex items-center gap-0.5 text-[color:var(--boa-ink-3)]"
          >
            <Command className="w-3 h-3" />K
          </span>
        </div>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-sm border"
          style={{ borderColor: "var(--boa-paper-3)" }}
        >
          <Bell className="w-3.5 h-3.5 text-[color:var(--boa-ink-2)]" />
        </button>
        {rightSlot}
      </div>
    </div>
  );
}
