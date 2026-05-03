import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";
import { Button } from "./components/ui/button";

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
    }
  }
});

function LoginScreen() {
  const { login } = useAuth();
  
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-secondary/10 blur-[120px]" />
      </div>
      
      <div className="w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-white/5 shadow-2xl mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-medium tracking-tight mb-2 synozur-gradient-text">Quorum</h1>
          <p className="text-muted-foreground">The executive war-room. Convene your advisors.</p>
        </div>
        
        <div className="bg-card/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 shadow-2xl">
          <Button onClick={login} className="w-full h-12 rounded-xl text-md font-medium" size="lg">
            Enter the Boardroom
          </Button>
        </div>
      </div>
    </div>
  );
}

function TenantRoutes({ params }: { params: { tenantId: string } }) {
  const { tenantId } = params;
  return (
    <AppShell tenantId={tenantId}>
      <Switch>
        <Route path="/t/:tenantId" component={() => <Dashboard tenantId={tenantId} />} />
        <Route path="/t/:tenantId/boards" component={() => <Boards tenantId={tenantId} />} />
        <Route path="/t/:tenantId/boards/new" component={() => <CreateBoard tenantId={tenantId} />} />
        <Route path="/t/:tenantId/boards/:boardId" component={({ params }) => <BoardDetail tenantId={tenantId} boardId={params.boardId} />} />
        <Route path="/t/:tenantId/boards/:boardId/members/:memberId" component={({ params }) => <MemberEditor tenantId={tenantId} boardId={params.boardId} memberId={params.memberId} />} />
        <Route path="/t/:tenantId/boards/:boardId/run" component={({ params }) => <SessionRunner tenantId={tenantId} boardId={params.boardId} />} />
        <Route path="/t/:tenantId/admin" component={() => <TenantAdmin tenantId={tenantId} />} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return null; // Or a nice splash screen
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
      
      {/* Session detail needs a shell but doesn't naturally have tenantId in URL without extra lookup. 
          For simplicity, we'll wrap it in a lightweight shell or let it render its own back button to the board. 
          Using a blank shell for now. */}
      <Route path="/sessions/:sessionId" component={({ params }) => (
         <div className="min-h-[100dvh] bg-background">
           <div className="max-w-5xl mx-auto p-4 md:p-8">
             <SessionDetail sessionId={params.sessionId} />
           </div>
         </div>
      )} />
      
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
