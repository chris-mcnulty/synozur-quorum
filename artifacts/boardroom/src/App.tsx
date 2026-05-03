import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import { useState, useEffect, useRef } from "react";

import { AppShell } from "./components/AppShell";
import Tenants from "./pages/Tenants";
import Dashboard from "./pages/Dashboard";
import Boards from "./pages/Boards";
import CreateBoard from "./pages/CreateBoard";
import BoardDetail from "./pages/BoardDetail";
import MemberEditor from "./pages/MemberEditor";
import SessionRunner from "./pages/SessionRunner";
import SessionDetail from "./pages/SessionDetail";
import SessionCompare from "./pages/SessionCompare";
import TenantAdmin from "./pages/TenantAdmin";
import Connections from "./pages/Connections";
import Decisions from "./pages/Decisions";
import Intelligence from "./pages/Intelligence";
import DocsMcp from "./pages/DocsMcp";
import CrossExamLauncher from "./pages/CrossExamLauncher";
import CrossExamDetail from "./pages/CrossExamDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function useAuthConfig() {
  const [entraEnabled, setEntraEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/auth/config", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { entraEnabled?: boolean }) => setEntraEnabled(!!d.entraEnabled))
      .catch(() => setEntraEnabled(false));
  }, []);
  return { entraEnabled };
}

function LoginScreen() {
  const { entraEnabled } = useAuthConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/login/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Invalid credentials");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnonymous() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/login/anonymous", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError("Could not create guest session");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEntra() {
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/+$/, "");
    window.location.href = `/api/login/entra?returnTo=${encodeURIComponent(base || "/")}`;
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--boa-paper)",
    borderColor: "var(--boa-rule)",
    color: "var(--boa-ink)",
  };

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
            <span className="boa-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--boa-brass)" }}>
              Vol. I
            </span>
            <div className="h-[1px] w-8" style={{ background: "var(--boa-brass-2)" }} />
            <span className="boa-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(245,241,234,0.5)" }}>
              Est. 2026
            </span>
          </div>

          <div>
            <h1 className="boa-display text-5xl md:text-7xl mb-4 tracking-tight">Quorum</h1>
            <p className="text-[15px] max-w-md leading-relaxed" style={{ color: "rgba(245,241,234,0.7)" }}>
              The executive war-room. Convene your council of advisors. Deliberate, decide, record.
            </p>
          </div>
        </div>

        <div className="pt-24">
          <div className="w-12 h-[1px] mb-6" style={{ background: "var(--boa-brass)" }} />
          <p className="boa-display text-lg italic max-w-sm leading-snug" style={{ color: "rgba(245,241,234,0.85)" }}>
            "Quorum (n.) — the minimum number of voices required for a council to act."
          </p>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-16 relative">
        <div className="w-full max-w-[440px] flex flex-col">
          <div className="mb-8">
            <div className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: "var(--boa-ink-3)" }}>
              Authentication required
            </div>
            <h2 className="boa-display text-3xl mb-2" style={{ color: "var(--boa-ink)" }}>
              Enter the boardroom
            </h2>
            <p className="text-[14px]" style={{ color: "var(--boa-ink-3)" }}>
              Sign in to access your tenants and convene the council.
            </p>
          </div>

          {/* Email + password form */}
          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3 mb-5">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="login-email"
                className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Email
              </label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 text-[14px] rounded-sm border outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--boa-brass)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--boa-rule)")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="login-password"
                className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 text-[14px] rounded-sm border outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--boa-brass)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--boa-rule)")}
              />
            </div>

            {error && (
              <p className="text-[12px] px-1" style={{ color: "#b04040" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="boa-cta w-full py-3 rounded-sm text-[14px] font-medium tracking-wide transition-opacity mt-1"
              style={{ opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-[1px]" style={{ background: "var(--boa-rule)" }} />
            <span className="boa-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
              or
            </span>
            <div className="flex-1 h-[1px]" style={{ background: "var(--boa-rule)" }} />
          </div>

          {/* Entra SSO — only shown when ENTRA_CLIENT_ID etc. are configured */}
          {entraEnabled && (
            <button
              onClick={handleEntra}
              disabled={submitting}
              className="w-full py-3 rounded-sm text-[14px] font-medium tracking-wide border transition-colors mb-3 flex items-center justify-center gap-2"
              style={{
                borderColor: "var(--boa-rule)",
                color: "var(--boa-ink)",
                background: "transparent",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 23 23" fill="none" aria-hidden="true">
                <path d="M1 1h10v10H1z" fill="#f25022" />
                <path d="M12 1h10v10H12z" fill="#7fba00" />
                <path d="M1 12h10v10H1z" fill="#00a4ef" />
                <path d="M12 12h10v10H12z" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>
          )}

          {/* Anonymous access */}
          <button
            onClick={handleAnonymous}
            disabled={submitting}
            className="w-full py-2.5 text-[13px] tracking-wide transition-opacity"
            style={{ color: "var(--boa-ink-3)", background: "transparent", opacity: submitting ? 0.5 : 1 }}
          >
            Continue as guest
          </button>

          <div className="mt-8 boa-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--boa-ink-3)" }}>
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
        path="/t/:tenantId/connections"
        component={() => (
          <AppShell tenantId={tenantId} active="connections">
            <Connections tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/intelligence"
        component={() => (
          <AppShell tenantId={tenantId} active="intelligence">
            <Intelligence tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/decisions"
        component={() => (
          <AppShell tenantId={tenantId} active="decisions">
            <Decisions tenantId={tenantId} />
          </AppShell>
        )}
      />
      <Route
        path="/t/:tenantId/cross-examinations/new"
        component={() => (
          <AppShell tenantId={tenantId} active="dashboard">
            <CrossExamLauncher tenantId={tenantId} />
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
        <Route
          path="/share/compare/:token"
          component={({ params }) => (
            <div
              className="boa min-h-[100dvh]"
              style={{ background: "var(--boa-paper)" }}
            >
              <SessionCompare shareToken={params.token} />
            </div>
          )}
        />
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
      <Route
        path="/share/compare/:token"
        component={({ params }) => (
          <div
            className="boa min-h-[100dvh]"
            style={{ background: "var(--boa-paper)" }}
          >
            <SessionCompare shareToken={params.token} />
          </div>
        )}
      />
      <Route path="/tenants" component={Tenants} />
      <Route path="/docs/mcp" component={DocsMcp} />
      <Route path="/t/:tenantId/*?" component={TenantRoutes} />
      <Route
        path="/sessions/compare"
        component={() => (
          <div
            className="boa min-h-[100dvh]"
            style={{ background: "var(--boa-paper)" }}
          >
            <SessionCompare />
          </div>
        )}
      />
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
      <Route
        path="/cross-examinations/:crossExamId"
        component={({ params }) => (
          <div
            className="boa min-h-[100dvh]"
            style={{ background: "var(--boa-paper)" }}
          >
            <CrossExamDetail crossExamId={params.crossExamId} />
          </div>
        )}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
