import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useListTenants } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Layers,
  Plug,
  Scale,
  Settings,
  LogOut,
  ChevronsUpDown,
  Search,
  Command,
  Bell,
  ChevronRight,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  tenantId: string;
  active?: "dashboard" | "boards" | "connections" | "decisions" | "settings";
  crumbs?: { label: string; href?: string }[];
  rightSlot?: React.ReactNode;
}

export function AppShell({ children, tenantId, active, crumbs, rightSlot }: AppShellProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: tenants } = useListTenants();

  const tenant = tenants?.find((t) => t.tenant.id === tenantId)?.tenant;
  const role = tenants?.find((t) => t.tenant.id === tenantId)?.role;

  const inferredActive: AppShellProps["active"] =
    active ??
    (location.includes("/admin")
      ? "settings"
      : location.includes("/connections")
      ? "connections"
      : location.includes("/decisions")
      ? "decisions"
      : location.includes("/boards")
      ? "boards"
      : "dashboard");

  const navPrimary = [
    { key: "dashboard" as const, label: "Overview", icon: LayoutDashboard, href: `/t/${tenantId}` },
    { key: "boards" as const, label: "Boards", icon: Layers, href: `/t/${tenantId}/boards` },
    { key: "connections" as const, label: "Connections", icon: Plug, href: `/t/${tenantId}/connections` },
    { key: "decisions" as const, label: "Decisions", icon: Scale, href: `/t/${tenantId}/decisions` },
  ];
  const navSecondary = [
    { key: "settings" as const, label: "Tenant settings", icon: Settings, href: `/t/${tenantId}/admin` },
  ];

  const initials = (user?.email || "U").slice(0, 2).toUpperCase();

  const resolvedCrumbs = crumbs ?? [
    { label: tenant?.name || "Workspace" },
    {
      label:
        inferredActive === "boards"
          ? "Boards"
          : inferredActive === "settings"
          ? "Settings"
          : inferredActive === "connections"
          ? "Connections"
          : "Overview",
    },
  ];

  return (
    <div className="boa min-h-[100dvh] flex">
      {/* Sidebar */}
      <aside className="boa-ink-panel w-[244px] shrink-0 hidden md:flex flex-col border-r boa-rule sticky top-0 h-[100dvh]">
        <div className="px-5 pt-5 pb-4 border-b boa-rule">
          <div className="flex items-baseline gap-2">
            <span className="boa-display text-[22px] leading-none" style={{ color: "var(--boa-paper)" }}>
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

        <Link href="/tenants">
          <button
            className="mx-3 mt-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left hover:bg-[rgba(245,241,234,0.06)] transition-colors"
            style={{ borderColor: "rgba(245,241,234,0.12)", background: "rgba(245,241,234,0.03)" }}
          >
            <div className="min-w-0">
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "rgba(245,241,234,0.45)" }}
              >
                Tenant
              </div>
              <div className="text-[13px] truncate" style={{ color: "var(--boa-paper)" }}>
                {tenant?.name || "Loading…"}
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5" style={{ color: "rgba(245,241,234,0.55)" }} />
          </button>
        </Link>

        <nav className="px-2 mt-2 flex-1">
          <SectionLabel>Workspace</SectionLabel>
          <ul className="space-y-0.5 mb-4">
            {navPrimary.map((it) => (
              <NavItem key={it.key} item={it} active={inferredActive === it.key} />
            ))}
          </ul>
          <SectionLabel>Administration</SectionLabel>
          <ul className="space-y-0.5">
            {navSecondary.map((it) => (
              <NavItem key={it.key} item={it} active={inferredActive === it.key} />
            ))}
          </ul>
        </nav>

        <div className="px-3 pb-3 border-t boa-rule pt-3">
          <div className="flex items-center gap-2 px-2 py-2 rounded-sm">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center boa-mono text-[10px]"
              style={{ background: "var(--boa-brass)", color: "#1a1208" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] truncate" style={{ color: "var(--boa-paper)" }}>
                {user?.email || "—"}
              </div>
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "rgba(245,241,234,0.45)" }}
              >
                {role || "Member"}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1 rounded-sm hover:bg-[rgba(245,241,234,0.08)] transition-colors"
              style={{ color: "rgba(245,241,234,0.55)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <div
          className="h-[56px] shrink-0 flex items-center justify-between px-6 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--boa-paper-3)", background: "#fbf8f1" }}
        >
          <nav className="flex items-center gap-1.5 text-[12.5px] min-w-0">
            {resolvedCrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {c.href ? (
                  <Link href={c.href}>
                    <span
                      className="truncate hover:underline cursor-pointer"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      {c.label}
                    </span>
                  </Link>
                ) : (
                  <span
                    className="truncate"
                    style={{
                      color:
                        i === resolvedCrumbs.length - 1
                          ? "var(--boa-ink)"
                          : "var(--boa-ink-3)",
                    }}
                  >
                    {c.label}
                  </span>
                )}
                {i < resolvedCrumbs.length - 1 && (
                  <ChevronRight
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: "var(--boa-ink-3)" }}
                  />
                )}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-sm border w-[280px]"
              style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: "var(--boa-ink-3)" }} />
              <span className="text-[12px] flex-1" style={{ color: "var(--boa-ink-3)" }}>
                Search boards, members, sessions…
              </span>
              <span
                className="boa-mono text-[10px] flex items-center gap-0.5"
                style={{ color: "var(--boa-ink-3)" }}
              >
                <Command className="w-3 h-3" />K
              </span>
            </div>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-sm border"
              style={{ borderColor: "var(--boa-paper-3)" }}
            >
              <Bell className="w-3.5 h-3.5" style={{ color: "var(--boa-ink-2)" }} />
            </button>
            {rightSlot}
          </div>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="boa-mono text-[10px] uppercase tracking-[0.20em] px-2 pb-1.5 pt-1"
      style={{ color: "rgba(245,241,234,0.40)" }}
    >
      {children}
    </div>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; href: string };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href}>
        <a
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-[13px] cursor-pointer transition-colors"
          style={
            active
              ? { background: "rgba(245,241,234,0.08)", color: "var(--boa-paper)" }
              : { color: "rgba(245,241,234,0.72)" }
          }
        >
          <span className="flex items-center gap-2.5">
            <Icon
              className="w-[15px] h-[15px]"
              style={{ color: active ? "var(--boa-brass-2)" : "rgba(245,241,234,0.55)" }}
            />
            {item.label}
          </span>
        </a>
      </Link>
    </li>
  );
}
