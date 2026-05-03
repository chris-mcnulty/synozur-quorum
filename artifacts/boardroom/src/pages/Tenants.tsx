import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useListTenants, useCreateTenant } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, ArrowRight } from "lucide-react";
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
        data: { name: newTenantName, slug: newTenantSlug }
      });
      setIsCreateOpen(false);
      setLocation(`/t/${tenant.id}`);
    } catch (err) {
      toast({
        title: "Error creating tenant",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle single membership redirect
  if (memberships?.length === 1 && !isCreateOpen) {
    const lastUsed = localStorage.getItem("last_tenant_id");
    if (lastUsed === memberships[0].tenant.id || !lastUsed) {
      setLocation(`/t/${memberships[0].tenant.id}`);
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 bg-card/50 backdrop-blur">
        <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
              Q
            </div>
            <span className="font-semibold tracking-tight">Quorum</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto py-12 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-medium tracking-tight mb-2">Your Organizations</h1>
            <p className="text-muted-foreground">Select a tenant to access the boardroom.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new organization</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTenant} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input 
                    id="name" 
                    value={newTenantName}
                    onChange={(e) => {
                      setNewTenantName(e.target.value);
                      if (!newTenantSlug) {
                        setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                      }
                    }}
                    placeholder="Acme Corp" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input 
                    id="slug" 
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value)}
                    placeholder="acme-corp" 
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createTenant.isPending || !newTenantName || !newTenantSlug}>
                    {createTenant.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {memberships?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No organizations yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Create your first organization to start convening boards and running advisory sessions.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>Create Organization</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {memberships?.map((membership) => (
              <Link key={membership.tenant.id} href={`/t/${membership.tenant.id}`}>
                <Card className="hover-elevate cursor-pointer transition-colors border-white/5 bg-card/50">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{membership.tenant.name}</CardTitle>
                        <CardDescription className="mt-1">{membership.tenant.slug}</CardDescription>
                      </div>
                      <div className="text-xs font-medium px-2 py-1 rounded-md bg-secondary/10 text-secondary">
                        {membership.role}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-end text-sm text-primary font-medium opacity-0 hover:opacity-100 transition-opacity">
                    Enter <ArrowRight className="w-4 h-4 ml-1" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}