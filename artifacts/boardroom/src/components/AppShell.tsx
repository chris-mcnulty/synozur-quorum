import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListTenants,
  useListTenantNotifications,
  useMarkNotificationRead,
  type TenantNotification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Layers,
  Plug,
  Scale,
  Settings,
  BarChart3,
  LogOut,
  ChevronsUpDown,
  Search,
  Command,
  Bell,
  ChevronRight,
  FileStack,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppShellProps {
  children: React.ReactNode;
  tenantId: string;
  active?: "dashboard" | "boards" | "connections" | "decisions" | "intelligence" | "settings" | "context";
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
      : location.includes("/context")
      ? "context"
      : location.includes("/connections")
      ? "connections"
      : location.includes("/intelligence")
      ? "intelligence"
      : location.includes("/decisions")
      ? "decisions"
      : location.includes("/boards")
      ? "boards"
      : "dashboard");

  const navPrimary = [
    { key: "dashboard" as const, label: "Overview",     icon: LayoutDashboard, href: `/t/${tenantId}` },
    { key: "boards"    as const, label: "Boards",       icon: Layers,          href: `/t/${tenantId}/boards` },
    { key: "intelligence" as const, label: "Intelligence", icon: BarChart3,    href: `/t/${tenantId}/intelligence` },
    { key: "connections"  as const, label: "Connections",  icon: Plug,         href: `/t/${tenantId}/connections` },
    { key: "decisions"    as const, label: "Decisions",    icon: Scale,        href: `/t/${tenantId}/decisions` },
    { key: "context"      as const, label: "Context Docs",  icon: FileStack,    href: `/t/${tenantId}/context` },
  ];
  const navSecondary = [
    { key: "settings" as const, label: "Tenant settings", icon: Settings, href: `/t/${tenantId}/admin` },
  ];

  const initials = (user?.email || "U").slice(0, 2).toUpperCase();

  const resolvedCrumbs = crumbs ?? [
    { label: tenant?.name || "Workspace" },
    {
      label:
        inferredActive === "boards"       ? "Boards"
        : inferredActive === "settings"   ? "Settings"
        : inferredActive === "connections"? "Connections"
        : inferredActive === "intelligence"? "Intelligence"
        : inferredActive === "decisions"  ? "Decisions"
        : inferredActive === "context"    ? "Context Docs"
        : "Overview",
    },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-[244px] shrink-0 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-[100dvh]">
        {/* Brand header */}
        <div className="px-5 pt-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-baseline gap-2">
            <span className="boa-display text-[22px] leading-none text-sidebar-foreground">
              Quorum
            </span>
            <span className="boa-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              B/A
            </span>
          </div>
          <div className="boa-mono text-[10px] mt-1 uppercase tracking-[0.18em] text-muted-foreground">
            Board of advisors
          </div>
        </div>

        {/* Tenant switcher */}
        <Link href="/tenants">
          <button className="mx-3 mt-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-md border border-sidebar-border px-3 py-2 text-left hover:bg-sidebar-accent/50 transition-colors bg-sidebar-accent/20">
            <div className="min-w-0">
              <div className="boa-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Tenant
              </div>
              <div className="text-[13px] truncate text-sidebar-foreground">
                {tenant?.name || "Loading…"}
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </button>
        </Link>

        {/* Nav */}
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

        {/* User footer */}
        <div className="px-3 pb-3 border-t border-sidebar-border pt-3">
          <div className="flex items-center gap-2 px-2 py-2 rounded-md">
            <div className="w-7 h-7 rounded-full flex items-center justify-center boa-mono text-[10px] synozur-gradient text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] truncate text-sidebar-foreground">
                {user?.email || "—"}
              </div>
              <div className="boa-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {role || "Member"}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1 rounded-sm hover:bg-sidebar-accent/50 transition-colors text-muted-foreground hover:text-sidebar-foreground"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar — with gradient top border from aurora */}
        <div className="page-header-gradient-bar h-[56px] shrink-0 flex items-center justify-between px-6 border-b border-border sticky top-0 z-10 bg-background">
          <nav className="flex items-center gap-1.5 text-[12.5px] min-w-0">
            {resolvedCrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {c.href ? (
                  <Link href={c.href}>
                    <span className="truncate hover:underline cursor-pointer text-muted-foreground">
                      {c.label}
                    </span>
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "truncate",
                      i === resolvedCrumbs.length - 1 ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {c.label}
                  </span>
                )}
                {i < resolvedCrumbs.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                )}
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card w-[260px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[12px] flex-1 text-muted-foreground">
                Search boards, members, sessions…
              </span>
              <span className="boa-mono text-[10px] flex items-center gap-0.5 text-muted-foreground">
                <Command className="w-3 h-3" />K
              </span>
            </div>
            <NotificationsBell tenantId={tenantId} />
            <ThemeToggle />
            {rightSlot}
          </div>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

/* ── Notifications bell ─────────────────────────────────────── */

interface NotificationPayload {
  link?: string;
  sessionId?: string;
  branchedSessionId?: string;
}

function notificationLink(n: TenantNotification): string | null {
  const p = (n.payload ?? null) as NotificationPayload | null;
  if (p && typeof p.link === "string" && p.link.length > 0) return p.link;
  if (p && typeof p.branchedSessionId === "string") return `/sessions/${p.branchedSessionId}`;
  if (p && typeof p.sessionId === "string") return `/sessions/${p.sessionId}#follow-ups`;
  return null;
}

function NotificationsBell({ tenantId }: { tenantId: string }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const { data, queryKey } = useListTenantNotifications(
    tenantId,
    {},
    {
      query: {
        enabled: isAuthenticated && !!tenantId,
        refetchInterval: 30_000,
        queryKey: ["/api/tenants", tenantId, "notifications"],
      },
    },
  );

  const markRead = useMarkNotificationRead({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey }); } },
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const list: TenantNotification[] = data ?? [];
  const unreadCount = list.filter((n) => !n.readAt).length;

  const onClick = (n: TenantNotification) => {
    if (!n.readAt) markRead.mutate({ id: n.id });
    const link = notificationLink(n);
    setOpen(false);
    if (link) {
      const [path, hash] = link.split("#");
      setLocation(path);
      if (hash) {
        const start = Date.now();
        const tryScroll = () => {
          const el = document.getElementById(hash);
          if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
          if (Date.now() - start < 5_000) window.requestAnimationFrame(tryScroll);
        };
        window.requestAnimationFrame(tryScroll);
      }
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 boa-mono text-[9px] min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center synozur-gradient text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[360px] max-h-[70vh] overflow-auto rounded-lg border border-border shadow-xl z-30 bg-popover text-popover-foreground">
          <div className="px-3 py-2 border-b border-border sticky top-0 boa-mono text-[10px] uppercase tracking-[0.18em] bg-popover text-muted-foreground">
            Notifications
          </div>
          {list.length === 0 ? (
            <div className="px-3 py-6 boa-mono text-[10px] uppercase tracking-[0.15em] text-center text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <ul>
              {list.map((n) => {
                const unread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => onClick(n)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 border-b border-border hover:bg-accent/50 transition-colors flex gap-2",
                        unread ? "bg-primary/5" : ""
                      )}
                    >
                      <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", unread ? "bg-primary" : "bg-transparent")} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] font-medium truncate text-foreground">{n.title}</span>
                        {n.body && (
                          <span className="block text-[12px] mt-0.5 line-clamp-2 text-muted-foreground">{n.body}</span>
                        )}
                        <span className="block boa-mono text-[10px] mt-1 uppercase tracking-[0.12em] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar helpers ────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="boa-mono text-[10px] uppercase tracking-[0.20em] px-2 pb-1.5 pt-1 text-muted-foreground/70">
      {children}
    </div>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { label: string; icon: React.ComponentType<{ className?: string }>; href: string };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href}>
        <a
          className={cn(
            "relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors",
            active
              ? "sidebar-item-active-gradient bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          )}
        >
          <Icon
            className={cn(
              "w-[15px] h-[15px] shrink-0",
              active ? "text-primary" : "text-muted-foreground"
            )}
          />
          {item.label}
        </a>
      </Link>
    </li>
  );
}
