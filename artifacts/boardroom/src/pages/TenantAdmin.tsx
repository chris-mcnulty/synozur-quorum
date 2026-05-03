import { useState } from "react";
import { useListTenantMembers, useInviteTenantMember } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Shield, User } from "lucide-react";
import { format } from "date-fns";

export default function TenantAdmin({ tenantId }: { tenantId: string }) {
  const { data: members, isLoading, refetch } = useListTenantMembers(tenantId);
  const inviteMember = useInviteTenantMember();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      await inviteMember.mutateAsync({
        tenantId,
        data: { email, role: role as any }
      });
      toast({ title: "Invitation sent", description: `Added ${email} as ${role}.` });
      setEmail("");
      refetch();
    } catch (err) {
      toast({
        title: "Error inviting member",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Organization Admin</h1>
        <p className="text-muted-foreground mt-1">Manage members and organization settings.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Invite Member</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="colleague@example.com" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={inviteMember.isPending || !email}>
                  {inviteMember.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Invite
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Members</CardTitle>
              <CardDescription>People with access to this organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members?.map(member => (
                  <div key={member.userId} className="flex items-center justify-between p-4 border rounded-xl bg-background/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                        {member.role === 'OWNER' || member.role === 'ADMIN' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.displayName || member.email || member.userId}</p>
                        <p className="text-xs text-muted-foreground">Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border">
                      {member.role}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}