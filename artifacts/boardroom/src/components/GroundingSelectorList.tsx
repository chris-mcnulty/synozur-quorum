import { useState } from "react";
import {
  useListGroundingSelectors,
  useCreateGroundingSelector,
  useUpdateGroundingSelector,
  useDeleteGroundingSelector,
  usePreviewGroundingSelector,
  useListTenantConnections,
  GroundingProviderName,
  type GroundingSelector,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, Loader2, Edit2, Save, X } from "lucide-react";
import { Link } from "wouter";

interface Props {
  tenantId: string;
  scope: { boardId: string } | { boardMemberId: string };
}

const PROVIDER_LABELS: Record<string, string> = {
  linear: "Linear",
  notion: "Notion",
  "google-docs": "Google Docs",
  github: "GitHub",
  slack: "Slack",
  jira: "Jira",
  hubspot: "HubSpot",
};

const PROVIDER_HINTS: Record<string, string> = {
  linear: `{"label":"P0","states":["In Progress","Todo"],"updatedWithinDays":14,"limit":20}`,
  notion: `{"databaseId":"<database-id>"}  or  {"pageId":"<page-id>"}`,
  "google-docs": `{"documentId":"<docs-id>"}`,
  github: `{"repo":"owner/name","mode":"readme"}  or  {"repo":"owner/name","mode":"issues","state":"open"}`,
  slack: `{"channel":"general","daysBack":7,"limit":30}  or  {"channel":"C0123ABC","daysBack":3}`,
  jira: `{"jql":"project = ENG AND status = \\"In Progress\\" ORDER BY updated DESC","limit":20}`,
  hubspot: `{"objectType":"deals","limit":20}  or  {"objectType":"contacts","search":"acme.com"}`,
};

export function GroundingSelectorList({ tenantId, scope }: Props) {
  const params =
    "boardId" in scope
      ? { boardId: scope.boardId }
      : { memberId: scope.boardMemberId };
  const { data: selectors, refetch, isLoading } =
    useListGroundingSelectors(params);
  const { data: connections } = useListTenantConnections(tenantId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--boa-brass)" }} />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px]" style={{ color: "var(--boa-ink-2)" }}>
          Grounding selectors fetch live snapshots from connected sources at the
          start of every session and inject them into the council's context.
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
            style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
          >
            <Plus className="w-3 h-3" /> Add selector
          </button>
        )}
      </div>

      {adding && (
        <SelectorForm
          tenantId={tenantId}
          scope={scope}
          connections={connections ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refetch();
          }}
        />
      )}

      <div className="border-t border-b boa-rule-strong divide-y boa-rule">
        {(selectors ?? []).map((s) =>
          editing === s.id ? (
            <SelectorForm
              key={s.id}
              tenantId={tenantId}
              scope={scope}
              connections={connections ?? []}
              existing={s}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                refetch();
              }}
            />
          ) : (
            <SelectorRow
              key={s.id}
              selector={s}
              tenantId={tenantId}
              onEdit={() => setEditing(s.id)}
              onChanged={() => refetch()}
            />
          ),
        )}
        {(selectors ?? []).length === 0 && !adding && (
          <div
            className="py-10 text-center boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            No selectors configured.
            <div className="mt-2 normal-case tracking-normal text-[12px]">
              Connect sources on the{" "}
              <Link href={`/t/${tenantId}/connections`}>
                <span
                  className="underline cursor-pointer"
                  style={{ color: "var(--boa-brass)" }}
                >
                  Connections
                </span>
              </Link>{" "}
              page first.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectorRow({
  selector,
  tenantId,
  onEdit,
  onChanged,
}: {
  selector: GroundingSelector;
  tenantId: string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const del = useDeleteGroundingSelector();
  const preview = usePreviewGroundingSelector();
  const [previewText, setPreviewText] = useState<string | null>(null);
  const { toast } = useToast();

  const onPreview = async () => {
    try {
      const out = await preview.mutateAsync({
        data: {
          tenantId,
          provider: selector.provider as GroundingProviderName,
          queryJson: selector.queryJson,
          tokenBudget: selector.tokenBudget,
        },
      });
      setPreviewText(
        `[${out.status}, ~${out.tokenEstimate} tok${out.truncated ? ", truncated" : ""}]\n\n${out.contentText || out.errorDetail || "(empty)"}`,
      );
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <span
          className="boa-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm"
          style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
        >
          {PROVIDER_LABELS[selector.provider] ?? selector.provider}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-medium truncate"
            style={{ color: "var(--boa-ink)" }}
          >
            {selector.name}
          </div>
          <div
            className="boa-mono text-[10px] truncate"
            style={{ color: "var(--boa-ink-3)" }}
          >
            {JSON.stringify(selector.queryJson)} · budget {selector.tokenBudget} tok
          </div>
        </div>
        <button
          type="button"
          onClick={onPreview}
          disabled={preview.isPending}
          className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
          style={{ color: "var(--boa-ink-2)" }}
          title="Preview"
        >
          {preview.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
          style={{ color: "var(--boa-ink-2)" }}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Delete this selector?")) return;
            await del.mutateAsync({ id: selector.id });
            onChanged();
          }}
          className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
          style={{ color: "var(--boa-vote-no)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {previewText !== null && (
        <pre
          className="mt-3 p-3 rounded-sm boa-mono text-[11px] whitespace-pre-wrap max-h-[260px] overflow-auto"
          style={{
            background: "var(--boa-paper-2)",
            color: "var(--boa-ink-2)",
            border: "1px solid var(--boa-paper-3)",
          }}
        >
          {previewText}
        </pre>
      )}
    </div>
  );
}

function SelectorForm({
  tenantId,
  scope,
  connections,
  existing,
  onClose,
  onSaved,
}: {
  tenantId: string;
  scope: { boardId: string } | { boardMemberId: string };
  connections: Array<{ provider: string; available: boolean; id?: string | null }>;
  existing?: GroundingSelector;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useCreateGroundingSelector();
  const update = useUpdateGroundingSelector();
  const { toast } = useToast();
  const [provider, setProvider] = useState<string>(
    existing?.provider ?? "linear",
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [queryText, setQueryText] = useState(
    JSON.stringify(existing?.queryJson ?? {}, null, 2),
  );
  const [tokenBudget, setTokenBudget] = useState(existing?.tokenBudget ?? 2000);

  const enabled = (p: string) =>
    connections.find((c) => c.provider === p && (c.id || c.available));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let queryJson: Record<string, unknown>;
    try {
      queryJson = JSON.parse(queryText);
    } catch {
      toast({ title: "Invalid JSON in query", variant: "destructive" });
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          data: { name, queryJson, tokenBudget },
        });
      } else {
        await create.mutateAsync({
          data: {
            ...("boardId" in scope ? { boardId: scope.boardId } : {}),
            ...("boardMemberId" in scope
              ? { boardMemberId: scope.boardMemberId }
              : {}),
            provider: provider as GroundingProviderName,
            name,
            queryJson,
            tokenBudget,
          },
        });
      }
      onSaved();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="py-4 space-y-3"
      style={{ background: "var(--boa-paper-2)" }}
    >
      <div className="grid md:grid-cols-3 gap-3">
        <label className="space-y-1 block">
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Source
          </span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={Boolean(existing)}
            className="w-full px-2 py-1.5 boa-mono text-[12px] border rounded-sm bg-white"
            style={{ borderColor: "var(--boa-paper-3)" }}
          >
            {Object.entries(PROVIDER_LABELS).map(([p, label]) => {
              const ok = enabled(p);
              return (
                <option key={p} value={p} disabled={!ok}>
                  {label}
                  {!ok ? " (not connected)" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label className="space-y-1 block md:col-span-2">
          <span
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Selector name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="P0 incidents this sprint"
            className="w-full px-2 py-1.5 text-[13px] border rounded-sm bg-white"
            style={{ borderColor: "var(--boa-paper-3)" }}
          />
        </label>
      </div>
      <label className="space-y-1 block">
        <span
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Query (JSON)
        </span>
        <textarea
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          rows={5}
          className="w-full px-2 py-1.5 boa-mono text-[11.5px] border rounded-sm bg-white"
          style={{ borderColor: "var(--boa-paper-3)" }}
        />
        <div
          className="boa-mono text-[10px]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Example: {PROVIDER_HINTS[provider]}
        </div>
      </label>
      <label className="space-y-1 block max-w-[180px]">
        <span
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Token budget
        </span>
        <input
          type="number"
          min={200}
          max={20000}
          step={100}
          value={tokenBudget}
          onChange={(e) => setTokenBudget(Number(e.target.value))}
          className="w-full px-2 py-1.5 boa-mono text-[12px] border rounded-sm bg-white"
          style={{ borderColor: "var(--boa-paper-3)" }}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending || update.isPending}
          className="boa-cta px-3 py-1.5 rounded-sm text-[12px] font-medium inline-flex items-center disabled:opacity-50"
        >
          {(create.isPending || update.isPending) ? (
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-3 h-3 mr-1.5" />
          )}
          {existing ? "Save changes" : "Create selector"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-sm text-[12px] border inline-flex items-center"
          style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
        >
          <X className="w-3 h-3 mr-1.5" />
          Cancel
        </button>
      </div>
    </form>
  );
}
