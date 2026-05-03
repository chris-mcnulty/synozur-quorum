import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useListTenants } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  tenantId: string;
}

export function AppShell({ children, tenantId }: AppShellProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const { data: tenants } = useListTenants();
  
  const tenant = tenants?.find(t => t.tenant.id === tenantId)?.tenant;

  const navItems = [
    { href: `/t/${tenantId}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `/t/${tenantId}/boards`, label: "Boards", icon: Users },
    { href: `/t/${tenantId}/admin`, label: "Admin", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-sidebar shrink-0 md:h-[100dvh] md:sticky md:top-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/tenants" className="flex items-center text-sidebar-foreground hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span className="font-medium truncate">{tenant?.name || "Loading..."}</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? location === item.href 
              : location.startsWith(item.href);
              
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm font-medium",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground sidebar-item-active-gradient" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border">
          <button 
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
