import {
  LayoutDashboard,
  Layers,
  History,
  FileText,
  Users,
  Settings,
  ChevronsUpDown,
} from "lucide-react";

type Item = {
  key: "dashboard" | "boards" | "sessions" | "documents" | "people" | "settings";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: string;
};

const PRIMARY: Item[] = [
  { key: "dashboard", label: "Overview",  icon: LayoutDashboard },
  { key: "boards",    label: "Boards",    icon: Layers,    count: "6" },
  { key: "sessions",  label: "Sessions",  icon: History,   count: "182" },
];

const SECONDARY: Item[] = [
  { key: "documents", label: "Grounding documents", icon: FileText, count: "47" },
  { key: "people",    label: "People & roles",      icon: Users,    count: "9" },
  { key: "settings",  label: "Tenant settings",     icon: Settings },
];

export function Sidebar({
  active,
  tenant = "Helix Capital",
}: {
  active: Item["key"];
  tenant?: string;
}) {
  return (
    <aside className="boa-ink-panel w-[244px] shrink-0 flex flex-col border-r boa-rule">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b boa-rule">
        <div className="flex items-baseline gap-2">
          <span
            className="boa-display text-[22px] leading-none"
            style={{ color: "var(--boa-paper)" }}
          >
            Quorum
          </span>
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-brass-2)" }}
          >
            B/A
          </span>
        </div>
        <div
          className="boa-mono text-[10px] mt-1 uppercase tracking-[0.18em]"
          style={{ color: "rgba(245,241,234,0.45)" }}
        >
          Board of advisors
        </div>
      </div>

      {/* Tenant switcher */}
      <button
        className="mx-3 mt-3 mb-2 flex items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left"
        style={{
          borderColor: "rgba(245,241,234,0.12)",
          background: "rgba(245,241,234,0.03)",
        }}
      >
        <div className="min-w-0">
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "rgba(245,241,234,0.45)" }}
          >
            Tenant
          </div>
          <div className="text-[13px] truncate" style={{ color: "var(--boa-paper)" }}>
            {tenant}
          </div>
        </div>
        <ChevronsUpDown
          className="w-3.5 h-3.5"
          style={{ color: "rgba(245,241,234,0.55)" }}
        />
      </button>

      <nav className="px-2 mt-2 flex-1">
        <SectionLabel>Workspace</SectionLabel>
        <ul className="space-y-0.5 mb-4">
          {PRIMARY.map((it) => (
            <NavItem key={it.key} item={it} active={active === it.key} />
          ))}
        </ul>
        <SectionLabel>Administration</SectionLabel>
        <ul className="space-y-0.5">
          {SECONDARY.map((it) => (
            <NavItem key={it.key} item={it} active={active === it.key} />
          ))}
        </ul>
      </nav>

      {/* Cost meter */}
      <div className="m-3 p-3 border boa-rule rounded-sm">
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "rgba(245,241,234,0.45)" }}
        >
          API spend · April
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span
            className="boa-display boa-num text-[22px]"
            style={{ color: "var(--boa-paper)" }}
          >
            $84.20
          </span>
          <span
            className="boa-mono text-[10px]"
            style={{ color: "var(--boa-brass-2)" }}
          >
            ▲ 12%
          </span>
        </div>
        <div
          className="mt-2 h-[3px] w-full rounded-full overflow-hidden"
          style={{ background: "rgba(245,241,234,0.10)" }}
        >
          <div
            className="h-full"
            style={{ width: "42%", background: "var(--boa-brass)" }}
          />
        </div>
        <div
          className="boa-mono text-[10px] mt-1.5 flex justify-between"
          style={{ color: "rgba(245,241,234,0.45)" }}
        >
          <span>$84 of $200</span>
          <span>1.4M tok</span>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-2 py-2 rounded-sm">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center boa-mono text-[10px]"
            style={{ background: "var(--boa-brass)", color: "#1a1208" }}
          >
            EM
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[12px] truncate"
              style={{ color: "var(--boa-paper)" }}
            >
              Elena Marsh
            </div>
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "rgba(245,241,234,0.45)" }}
            >
              Owner
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="boa-mono text-[10px] uppercase tracking-[0.20em] px-2 pb-1.5"
      style={{ color: "rgba(245,241,234,0.40)" }}
    >
      {children}
    </div>
  );
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <a
        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-[13px] group"
        style={
          active
            ? { background: "rgba(245,241,234,0.08)", color: "var(--boa-paper)" }
            : { color: "rgba(245,241,234,0.72)" }
        }
      >
        <span className="flex items-center gap-2.5">
          <Icon
            className="w-[15px] h-[15px]"
            style={{
              color: active ? "var(--boa-brass-2)" : "rgba(245,241,234,0.55)",
            }}
          />
          {item.label}
        </span>
        {item.count && (
          <span
            className="boa-mono text-[10px]"
            style={{ color: "rgba(245,241,234,0.45)" }}
          >
            {item.count}
          </span>
        )}
      </a>
    </li>
  );
}
