import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";

import { AppShell } from "./components/AppShell";
import Tenants from "./pages/Tenants";
import Dashboard from "./pages/Dashboard";
import Boards from "./pages/Boards";
import CreateBoard from "./pages/CreateBoard";
import BoardDetail from "./pages/BoardDetail";
import MemberEditor from "./pages/MemberEditor";
import SessionRunner from "./pages/SessionRunner";
import SessionDetail from "./pages/SessionDetail";
import TenantAdmin from "./pages/TenantAdmin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function LoginScreen() {
  const { login } = useAuth();

  return (
    <div className="boa min-h-[100dvh] flex flex-col md:flex-row" style={{ background: "var(--boa-paper)" }}>
      {/* Brand panel */}
      <div
        className="w-full md:w-[42%] flex flex-col justify-between p-8 md:p-16 border-r boa-rule"
        style={{
          background: "linear-gradient(145deg, var(--boa-ink) 0%, var(--boa-aubergine) 150%)",
          color: "var(--boa-paper)",
        }}
      >
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <span
              className="boa-mono text-[10px] tracking-[0.2em] uppercase"
              style={{ color: "var(--boa-brass)" }}
            >
              Vol. I
            </span>
            <div className="h-[1px] w-8" style={{ background: "var(--boa-brass-2)" }} />
            <span
              className="boa-mono text-[10px] tracking-[0.2em] uppercase"
              style={{ color: "rgba(245,241,234,0.5)" }}
            >
              Est. 2026
            </span>
          </div>

          <div>
            <h1 className="boa-display text-5xl md:text-7xl mb-4 tracking-tight">Quorum</h1>
            <p
              className="text-[15px] max-w-md leading-relaxed"
              style={{ color: "rgba(245,241,234,0.7)" }}
            >
              The executive war-room. Convene your council of advisors. Deliberate, decide, record.
            </p>
          </div>
        </div>

        <div className="pt-24">
          <div className="w-12 h-[1px] mb-6" style={{ background: "var(--boa-brass)" }} />
          <p
            className="boa-display text-lg italic max-w-sm leading-snug"
            style={{ color: "rgba(245,241,234,0.85)" }}
          >
            “Quorum (n.) — the minimum number of voices required for a council to act.”
          </p>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-16 relative">
        <div className="w-full max-w-[440px] flex flex-col">
          <div className="mb-10">
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Authentication required
            </div>
            <h2 className="boa-display text-3xl mb-2" style={{ color: "var(--boa-ink)" }}>
              Enter the boardroom
            </h2>
            <p className="text-[14px]" style={{ color: "var(--boa-ink-3)" }}>
              Sign in with your Replit account to access your tenants and convene the council.
            </p>
          </div>

          <button
            onClick={login}
            className="boa-cta w-full py-3.5 rounded-sm text-[14px] font-medium tracking-wide transition-colors"
          >
            Sign in with Replit
          </button>

          <div
            className="mt-10 boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Single-tenant isolation · Audit-grade transcripts
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantRoutes({ params }: { params: { tenantId: string } }) {
  const { tenantId } = params;
  return (
    <Switch>
      <Route
        path="/t/:tenantId"
        component={() => (
          <AppShell tenantId={tenantId} active="dashboard">
            <Dashboard tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/boards"
        component={() => (
          <AppShell tenantId={tenantId} active="boards">
            <Boards tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/boards/new"
        component={() => (
          <AppShell tenantId={tenantId} active="boards">
            <CreateBoard tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/boards/:boardId"
        component={({ params }) => (
          <AppShell tenantId={tenantId} active="boards">
            <BoardDetail tenantId={tenantId} boardId={params.boardId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/boards/:boardId/members/:memberId"
        component={({ params }) => (
          <AppShell tenantId={tenantId} active="boards">
            <MemberEditor
              tenantId={tenantId}
              boardId={params.boardId}
              memberId={params.memberId}
            />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/boards/:boardId/run"
        component={({ params }) => (
          <AppShell tenantId={tenantId} active="boards">
            <SessionRunner tenantId={tenantId} boardId={params.boardId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/admin"
        component={() => (
          <AppShell tenantId={tenantId} active="settings">
            <TenantAdmin tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="boa min-h-[100dvh] flex items-center justify-center"
        style={{ background: "var(--boa-paper)" }}
      >
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Convening…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LoginScreen} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/">
        <Redirect to="/tenants" />
      </Route>
      <Route path="/tenants" component={Tenants} />
      <Route path="/t/:tenantId/*?" component={TenantRoutes} />
      <Route
        path="/sessions/:sessionId"
        component={({ params }) => (
          <div
            className="boa min-h-[100dvh]"
            style={{ background: "var(--boa-paper)" }}
          >
            <SessionDetail sessionId={params.sessionId} />
          </div>
        )}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
