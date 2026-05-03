import { useEffect, useState } from "react";
import {
  useListTenantMembers,
  useInviteTenantMember,
  useGetTenantAudioSettings,
  useUpdateTenantAudioSettings,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Shield, Mic, Key, Trash2, Copy } from "lucide-react";
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
      await inviteMember.mutateAsync({ tenantId, data: { email, role: role as any } });
      toast({ title: "Invitation sent", description: `Added ${email} as ${role}.` });
      setEmail("");
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    }
  };

  if (isLoading)
    return (
      <div className="max-w-[1100px] mx-auto px-8 py-10">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10">
      <header className="mb-10">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          Administration
        </div>
        <h1 className="boa-display text-[36px] leading-tight" style={{ color: "var(--boa-ink)" }}>
          People & roles
        </h1>
        <p className="text-[14px] mt-2" style={{ color: "var(--boa-ink-3)" }}>
          Manage who can read, edit, and govern this tenant.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-10">
        <aside className="lg:col-span-1">
          <div
            className="boa-surface rounded-sm p-6"
          >
            <h2
              className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Invite member
            </h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  className="boa-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  className="boa-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Role
                </Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <button
                type="submit"
                disabled={inviteMember.isPending || !email}
                className="boa-cta w-full py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center justify-center disabled:opacity-50"
              >
                {inviteMember.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5 mr-2" />
                )}
                Send invite
              </button>
            </form>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <h2
            className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule flex justify-between items-baseline"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <span>Members ({members?.length || 0})</span>
          </h2>
          <div className="border-b boa-rule divide-y boa-rule">
            {members?.map((m) => (
              <div key={m.userId} className="py-4 flex items-center gap-4">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "var(--boa-paper-3)", color: "var(--boa-ink)" }}
                >
                  {m.role === "OWNER" || m.role === "ADMIN" ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <span className="boa-mono text-[10px]">
                      {(m.displayName || m.email || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate" style={{ color: "var(--boa-ink)" }}>
                    {m.displayName || m.email || m.userId}
                  </div>
                  <div className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                    Joined {format(new Date(m.joinedAt), "MMM d, yyyy")}
                  </div>
                </div>
                <span
                  className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-sm border"
                  style={{
                    borderColor: "var(--boa-paper-3)",
                    background: "var(--boa-paper-2)",
                    color: "var(--boa-ink-2)",
                  }}
                >
                  {m.role}
                </span>
              </div>
            ))}
            {!members?.length && (
              <div
                className="py-12 text-center boa-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                No members yet
              </div>
            )}
          </div>
        </div>
      </div>

      <AudioSettingsPanel tenantId={tenantId} />
      <McpKeysPanel tenantId={tenantId} />
    </div>
  );
}

interface McpKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  plaintext?: string;
}

const ALL_SCOPES = [
  "boards:read",
  "boards:write",
  "sessions:read",
  "sessions:write",
  "decisions:read",
  "decisions:write",
];

function McpKeysPanel({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<McpKey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["boards:read", "sessions:read"]);
  const [justCreated, setJustCreated] = useState<McpKey | null>(null);

  const apiBase =
    import.meta.env.BASE_URL.replace(/\/$/, "") || "";

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/tenants/${tenantId}/mcp-keys`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      setKeys(await r.json());
    } catch (err) {
      toast({
        title: "Could not load MCP keys",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || scopes.length === 0) return;
    setCreating(true);
    try {
      const r = await fetch(`${apiBase}/api/tenants/${tenantId}/mcp-keys`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, scopes }),
      });
      if (!r.ok) throw new Error(await r.text());
      const created: McpKey = await r.json();
      setJustCreated(created);
      setName("");
      await refresh();
    } catch (err) {
      toast({
        title: "Could not create key",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? Clients using it will stop working.")) return;
    try {
      const r = await fetch(
        `${apiBase}/api/tenants/${tenantId}/mcp-keys/${id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!r.ok && r.status !== 204) throw new Error(await r.text());
      await refresh();
    } catch (err) {
      toast({
        title: "Could not revoke",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="mt-16 pt-10 border-t boa-rule-strong">
      <div className="flex items-center gap-3 mb-2">
        <Key className="w-4 h-4" style={{ color: "var(--boa-brass)" }} />
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-brass)" }}
        >
          Integrations · MCP
        </div>
      </div>
      <h2 className="boa-display text-[28px] mb-2" style={{ color: "var(--boa-ink)" }}>
        MCP keys
      </h2>
      <p className="text-[13px] max-w-2xl mb-6" style={{ color: "var(--boa-ink-3)" }}>
        Tenant-scoped tokens for the Model Context Protocol server at{" "}
        <code>/api/mcp</code>. Use them to connect Claude Desktop, Cursor,
        Microsoft Copilot Studio, and the Microsoft 365 Agents Toolkit. See{" "}
        <a href="/docs/mcp" className="underline">
          /docs/mcp
        </a>{" "}
        for setup instructions.
      </p>

      <form
        onSubmit={create}
        className="boa-surface rounded-sm p-5 mb-6 grid lg:grid-cols-3 gap-4 items-end"
      >
        <div className="space-y-1.5">
          <Label
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Key name
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude Desktop · alice"
            required
          />
        </div>
        <div className="space-y-1.5 lg:col-span-1">
          <Label
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Scopes
          </Label>
          <div className="flex flex-wrap gap-2">
            {ALL_SCOPES.map((s) => {
              const on = scopes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setScopes((prev) =>
                      on ? prev.filter((x) => x !== s) : [...prev, s],
                    )
                  }
                  className="boa-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded-sm border"
                  style={{
                    borderColor: on ? "var(--boa-brass)" : "var(--boa-paper-3)",
                    background: on
                      ? "var(--boa-brass)"
                      : "var(--boa-paper-2)",
                    color: on ? "var(--boa-paper)" : "var(--boa-ink-2)",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || !name || scopes.length === 0}
          className="boa-cta py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center justify-center disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <Key className="w-3.5 h-3.5 mr-2" />
          )}
          Create key
        </button>
      </form>

      {justCreated?.plaintext && (
        <div
          className="boa-surface rounded-sm p-5 mb-6"
          style={{ borderColor: "var(--boa-brass)" }}
        >
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--boa-brass)" }}
          >
            New key — shown once
          </div>
          <div className="flex items-center gap-2 mb-2">
            <code
              className="text-[13px] font-mono break-all flex-1"
              style={{ color: "var(--boa-ink)" }}
            >
              {justCreated.plaintext}
            </code>
            <button
              type="button"
              onClick={() => copy(justCreated.plaintext!)}
              className="boa-cta px-3 py-1.5 rounded-sm text-[12px] inline-flex items-center"
            >
              <Copy className="w-3 h-3 mr-1" /> Copy
            </button>
          </div>
          <p className="text-[12px]" style={{ color: "var(--boa-ink-3)" }}>
            Copy this token now. You will not be able to view it again.
          </p>
        </div>
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--boa-brass)" }} />
      ) : !keys?.length ? (
        <div
          className="py-12 text-center boa-mono text-[10px] uppercase tracking-[0.18em] border boa-rule rounded-sm"
          style={{ color: "var(--boa-ink-3)" }}
        >
          No keys yet
        </div>
      ) : (
        <div className="border boa-rule rounded-sm divide-y boa-rule">
          {keys.map((k) => (
            <div key={k.id} className="px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium" style={{ color: "var(--boa-ink)" }}>
                  {k.name}
                </div>
                <div
                  className="boa-mono text-[10px] uppercase tracking-[0.12em] mt-0.5"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  {k.keyPrefix}…  ·  {k.scopes.join(" · ")}  ·{" "}
                  {k.lastUsedAt
                    ? `used ${format(new Date(k.lastUsedAt), "MMM d")}`
                    : "never used"}
                  {k.revokedAt ? "  ·  REVOKED" : ""}
                </div>
              </div>
              {!k.revokedAt && (
                <button
                  type="button"
                  onClick={() => revoke(k.id)}
                  className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-sm border inline-flex items-center"
                  style={{
                    borderColor: "var(--boa-paper-3)",
                    color: "var(--boa-ink-2)",
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioSettingsPanel({ tenantId }: { tenantId: string }) {
  const { data, refetch, isLoading } = useGetTenantAudioSettings(tenantId);
  const update = useUpdateTenantAudioSettings();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [feedTitle, setFeedTitle] = useState("");
  const [feedAuthor, setFeedAuthor] = useState("");

  useEffect(() => {
    if (data) {
      setEnabled(Boolean(data.enabled));
      setFeedTitle(data.feedTitle ?? "");
      setFeedAuthor(data.feedAuthor ?? "");
    }
  }, [data]);

  const save = async () => {
    try {
      await update.mutateAsync({
        tenantId,
        data: {
          enabled,
          feedTitle: feedTitle || null,
          feedAuthor: feedAuthor || null,
        },
      });
      refetch();
      toast({ title: "Audio settings saved" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-16 pt-10 border-t boa-rule-strong">
      <div className="flex items-center gap-3 mb-2">
        <Mic className="w-4 h-4" style={{ color: "var(--boa-brass)" }} />
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-brass)" }}
        >
          Audio briefings
        </div>
      </div>
      <h2 className="boa-display text-[28px] mb-2" style={{ color: "var(--boa-ink)" }}>
        Podcast minutes
      </h2>
      <p className="text-[13px] max-w-2xl mb-6" style={{ color: "var(--boa-ink-3)" }}>
        Allow members to generate narrated audio briefings of completed sessions and
        publish a per-board podcast feed. Each generation incurs a small TTS cost,
        previewed before run.
      </p>

      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--boa-brass)" }} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 max-w-3xl">
          <label
            className="boa-surface rounded-sm p-4 flex items-center gap-3 cursor-pointer"
            style={{ borderColor: "var(--boa-paper-3)" }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <div className="text-[13px] font-medium">Enable audio mode</div>
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Tenant-wide toggle
              </div>
            </div>
          </label>
          <div className="space-y-1.5 lg:col-span-1">
            <Label
              className="boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Feed title
            </Label>
            <Input
              value={feedTitle}
              onChange={(e) => setFeedTitle(e.target.value)}
              placeholder="Quorum minutes"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <Label
              className="boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Feed author
            </Label>
            <Input
              value={feedAuthor}
              onChange={(e) => setFeedAuthor(e.target.value)}
              placeholder="Tenant name"
            />
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={update.isPending}
        className="mt-6 boa-cta px-4 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
      >
        {update.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
        Save audio settings
      </button>
    </div>
  );
}
