import {
  useListTenantConnections,
  useEnableTenantConnection,
  useDisableTenantConnection,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2, CheckCircle2, AlertCircle } from "lucide-react";

const PROVIDER_INFO: Record<
  string,
  { label: string; description: string; tagline: string }
> = {
  linear: {
    label: "Linear",
    description:
      "Pull live issues, projects, and cycles. Perfect for grounding the board in current execution risk.",
    tagline: "Issues · Projects · Cycles",
  },
  notion: {
    label: "Notion",
    description:
      "Pull pages and databases. Great for product specs, planning docs, OKRs.",
    tagline: "Pages · Databases · Docs",
  },
  "google-docs": {
    label: "Google Docs",
    description:
      "Pull a specific doc by ID. Great for live strategy memos and PRDs.",
    tagline: "Documents",
  },
  github: {
    label: "GitHub",
    description:
      "Pull READMEs, files, and issues from a repo. Useful when the council is reviewing a technical decision.",
    tagline: "Repos · Files · Issues",
  },
};

export default function Connections({ tenantId }: { tenantId: string }) {
  const { data: connections, isLoading, refetch } =
    useListTenantConnections(tenantId);
  const enable = useEnableTenantConnection();
  const disable = useDisableTenantConnection();
  const { toast } = useToast();

  const onConnect = async (provider: string) => {
    try {
      await enable.mutateAsync({ tenantId, provider });
      refetch();
      toast({ title: `${PROVIDER_INFO[provider].label} connected` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Could not connect",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const onDisconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${PROVIDER_INFO[provider].label}?`)) return;
    await disable.mutateAsync({ tenantId, provider });
    refetch();
  };

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10 pb-32">
      <header className="mb-10">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          Connections
        </div>
        <h1
          className="boa-display text-[40px] leading-tight"
          style={{ color: "var(--boa-ink)" }}
        >
          Live grounding sources
        </h1>
        <p
          className="text-[14px] mt-3 max-w-2xl"
          style={{ color: "var(--boa-ink-2)" }}
        >
          Connect tools your team uses every day. The council can be grounded
          on live data — issues, docs, repos — instead of static uploads. Each
          board or advisor gets its own selector tuned to what it cares about.
        </p>
      </header>

      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {(connections ?? []).map((c) => {
            const info = PROVIDER_INFO[c.provider] ?? {
              label: c.provider,
              description: "",
              tagline: "",
            };
            const enabled = Boolean(c.id);
            const available = c.available;
            return (
              <div
                key={c.provider}
                className="p-5 border rounded-sm"
                style={{
                  borderColor: enabled
                    ? "var(--boa-ink)"
                    : "var(--boa-paper-3)",
                  background: enabled ? "var(--boa-paper-2)" : "transparent",
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2
                      className="boa-display text-[22px]"
                      style={{ color: "var(--boa-ink)" }}
                    >
                      {info.label}
                    </h2>
                    <div
                      className="boa-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      {info.tagline}
                    </div>
                  </div>
                  <StatusBadge enabled={enabled} available={available} />
                </div>
                <p
                  className="text-[13px] mb-4"
                  style={{ color: "var(--boa-ink-2)" }}
                >
                  {info.description}
                </p>
                {c.accountLabel && (
                  <div
                    className="boa-mono text-[10px] mb-3"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    Account: {c.accountLabel}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {enabled ? (
                    <button
                      onClick={() => onDisconnect(c.provider)}
                      className="px-3 py-1.5 rounded-sm text-[12px] border inline-flex items-center"
                      style={{
                        borderColor: "var(--boa-paper-3)",
                        color: "var(--boa-ink-2)",
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => onConnect(c.provider)}
                      disabled={!available || enable.isPending}
                      className="boa-cta px-3 py-1.5 rounded-sm text-[12px] font-medium inline-flex items-center disabled:opacity-40"
                    >
                      <Link2 className="w-3 h-3 mr-1.5" />
                      Connect
                    </button>
                  )}
                  {!available && !enabled && (
                    <span
                      className="boa-mono text-[10px]"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      Authorize {info.label} via Replit integrations first.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="mt-10 p-5 border rounded-sm text-[12.5px]"
        style={{
          borderColor: "var(--boa-paper-3)",
          background: "var(--boa-paper-2)",
          color: "var(--boa-ink-2)",
        }}
      >
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2"
          style={{ color: "var(--boa-ink-3)" }}
        >
          How it works
        </div>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>Authorize each integration once via Replit's connector flow.</li>
          <li>Connect it here so the workspace can use it.</li>
          <li>
            On each board (and optionally each advisor), add grounding
            selectors that describe exactly what to fetch.
          </li>
          <li>
            Every session runs the selectors live, persists snapshots, and
            shows them under <em>Grounded by</em> on the session minutes.
          </li>
        </ol>
      </div>
    </div>
  );
}

function StatusBadge({
  enabled,
  available,
}: {
  enabled: boolean;
  available: boolean;
}) {
  if (enabled && available) {
    return (
      <span
        className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm flex items-center gap-1"
        style={{ background: "rgba(63,123,69,0.10)", color: "var(--boa-vote-yes)" }}
      >
        <CheckCircle2 className="w-3 h-3" /> Active
      </span>
    );
  }
  if (enabled && !available) {
    return (
      <span
        className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm flex items-center gap-1"
        style={{ background: "rgba(196,106,42,0.10)", color: "var(--boa-flag)" }}
      >
        <AlertCircle className="w-3 h-3" /> Token expired
      </span>
    );
  }
  if (available) {
    return (
      <span
        className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
        style={{ background: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
      >
        Available
      </span>
    );
  }
  return (
    <span
      className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
      style={{ background: "var(--boa-paper-3)", color: "var(--boa-ink-3)" }}
    >
      Not authorized
    </span>
  );
}
