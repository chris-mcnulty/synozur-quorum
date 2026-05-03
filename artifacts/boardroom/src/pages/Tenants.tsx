import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useListTenants, useCreateTenant } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, ChevronRight, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tenants() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: memberships, isLoading } = useListTenants();
  const createTenant = useCreateTenant();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newTenantSlug) return;
    try {
      const tenant = await createTenant.mutateAsync({
        data: { name: newTenantName, slug: newTenantSlug },
      });
      setIsCreateOpen(false);
      setLocation(`/t/${tenant.id}`);
    } catch (err) {
      toast({
        title: "Error creating tenant",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="boa min-h-[100dvh] flex items-center justify-center" style={{ background: "var(--boa-paper)" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  }

  return (
    <div className="boa min-h-[100dvh] flex flex-col md:flex-row" style={{ background: "var(--boa-paper)" }}>
      <div
        className="w-full md:w-[40%] lg:w-[42%] flex flex-col justify-between p-8 md:p-16 border-r boa-rule"
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
            <span
              className="boa-mono text-[10px] tracking-[0.2em] uppercase"
              style={{ color: "rgba(245,241,234,0.5)" }}
            >
              Est. 2026
            </span>
          </div>
          <div>
            <h1 className="boa-display text-5xl md:text-7xl mb-4 tracking-tight">Quorum</h1>
            <p className="text-[15px] max-w-md leading-relaxed" style={{ color: "rgba(245,241,234,0.7)" }}>
              Choose a workspace to enter the boardroom.
            </p>
          </div>
        </div>

        <div className="pt-24">
          <div className="w-12 h-[1px] mb-6" style={{ background: "var(--boa-brass)" }} />
          <p className="boa-display text-lg italic max-w-sm leading-snug" style={{ color: "rgba(245,241,234,0.85)" }}>
            “Each tenant is a sovereign council. Their minutes are theirs alone.”
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 md:p-12 lg:p-16 relative">
        <div className="absolute top-6 right-6 md:top-8 md:right-8 flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div className="boa-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "rgba(20,20,26,0.4)" }}>
              Authenticated via Replit
            </div>
            <div className="boa-mono text-[10px] mt-0.5" style={{ color: "var(--boa-ink)" }}>
              {user?.email || "—"}
            </div>
          </div>
          <button
            onClick={logout}
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm flex items-center gap-1.5 hover:bg-[color:var(--boa-paper-2)] transition-colors"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
          >
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>

        <div className="w-full max-w-[520px] mx-auto md:mx-0 flex flex-col mt-12 md:mt-24">
          <div className="mb-10">
            <h2 className="boa-display text-3xl mb-2" style={{ color: "var(--boa-ink)" }}>
              Select workspace
            </h2>
            <p className="text-[14px]" style={{ color: "var(--boa-ink-3)" }}>
              Choose a tenant to continue.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {memberships?.map((m) => (
              <Link key={m.tenant.id} href={`/t/${m.tenant.id}`}>
                <button className="text-left group flex items-center justify-between p-4 boa-surface hover:border-[color:var(--boa-brass)] transition-colors rounded-sm cursor-pointer w-full">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className="boa-display text-xl group-hover:text-[color:var(--boa-brass)] transition-colors"
                        style={{ color: "var(--boa-ink)" }}
                      >
                        {m.tenant.name}
                      </span>
                      <span
                        className="boa-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border"
                        style={{
                          borderColor: "var(--boa-paper-3)",
                          background: "var(--boa-paper-2)",
                          color: "var(--boa-ink)",
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-3 boa-mono text-[10px]"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      <span className="boa-num">{m.tenant.slug}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[color:var(--boa-paper-3)] group-hover:text-[color:var(--boa-brass)] transition-colors" />
                </button>
              </Link>
            ))}

            {memberships?.length === 0 && (
              <div
                className="boa-surface p-6 rounded-sm text-center"
                style={{ color: "var(--boa-ink-3)" }}
              >
                <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2">No workspaces yet</div>
                <p className="text-[13px]">Create your first tenant to convene a council.</p>
              </div>
            )}
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <button
                className="mt-6 flex items-center justify-center gap-2 w-full p-4 border border-dashed rounded-sm cursor-pointer transition-colors"
                style={{ borderColor: "var(--boa-ink-3)", color: "var(--boa-ink-3)" }}
              >
                <Plus className="w-4 h-4" />
                <span className="text-[13px] font-medium">Create new tenant</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="boa-display text-2xl">Create a new tenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTenant} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Tenant name</Label>
                  <Input
                    id="name"
                    value={newTenantName}
                    onChange={(e) => {
                      setNewTenantName(e.target.value);
                      if (!newTenantSlug) {
                        setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                      }
                    }}
                    placeholder="Helix Capital"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value)}
                    placeholder="helix-capital"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={createTenant.isPending || !newTenantName || !newTenantSlug}
                    className="boa-cta px-4 py-2 rounded-sm text-[13px] font-medium disabled:opacity-50"
                  >
                    {createTenant.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 inline animate-spin" />}
                    Create tenant
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
