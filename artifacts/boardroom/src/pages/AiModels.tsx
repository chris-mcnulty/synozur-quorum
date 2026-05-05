import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Cpu,
  Activity,
  DollarSign,
  Zap,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

interface AiModelInfo {
  provider: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  promptCostPerMToken: number;
  completionCostPerMToken: number;
  costTier: "free" | "low" | "medium" | "high";
  description: string;
}

interface TenantAiModelConfig {
  id: string;
  tenantId: string;
  feature: string;
  provider: string;
  modelId: string;
  promptCostPerMToken: number;
  completionCostPerMToken: number;
  maxTokens: number;
  enabled: boolean;
  updatedAt: string;
  createdAt: string;
  modelInfo: AiModelInfo | null;
}

interface AiModelCatalog {
  models: AiModelInfo[];
  features: string[];
}

interface UsageBucket {
  requests: number;
  tokens: number;
  costMicrodollars: number;
}

interface AiUsageLogEntry {
  id: string;
  tenantId: string;
  sessionId: string | null;
  feature: string;
  provider: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostMicrodollars: number | null;
  latencyMs: number | null;
  success: boolean;
  errorCode: string | null;
  createdAt: string;
}

interface AiUsageStats {
  period: { start: string; end: string };
  totalRequests: number;
  totalTokens: number;
  totalCostMicrodollars: number;
  totalCostDollars: number;
  byFeature: Record<string, UsageBucket>;
  byModel: Record<string, UsageBucket>;
  dailyUsage: { date: string; requests: number; tokens: number; costMicrodollars: number }[];
  recentLogs: AiUsageLogEntry[];
}

const FEATURE_META: Record<string, { label: string; description: string; icon: typeof Brain }> = {
  advisor_deliberation: {
    label: "Advisor Deliberation",
    description: "Each advisor's individual contribution during a session run",
    icon: Brain,
  },
  chair_synthesis: {
    label: "Chair Synthesis",
    description: "The chair's synthesis across all advisor contributions",
    icon: Zap,
  },
  cross_exam_synthesis: {
    label: "Cross-Exam Synthesis",
    description: "Master synthesizer for cross-board examination alignment",
    icon: Activity,
  },
};

function formatFeature(f: string) {
  return FEATURE_META[f]?.label ?? f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMicrodollars(n: number) {
  const d = n / 1_000_000;
  if (d < 0.01) return `$${d.toFixed(6)}`;
  if (d < 1) return `$${d.toFixed(4)}`;
  return `$${d.toFixed(2)}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function costTierDot(tier: string) {
  const color =
    tier === "free" ? "bg-green-500"
    : tier === "low" ? "bg-blue-500"
    : tier === "medium" ? "bg-amber-500"
    : "bg-red-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function costTierLabel(tier: string) {
  const map: Record<string, { label: string; style: React.CSSProperties }> = {
    free: { label: "Free", style: { color: "#16a34a" } },
    low: { label: "Low cost", style: { color: "#2563eb" } },
    medium: { label: "Mid cost", style: { color: "#d97706" } },
    high: { label: "Premium", style: { color: "#dc2626" } },
  };
  const m = map[tier] ?? { label: tier, style: {} };
  return (
    <span
      className="boa-mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm border"
      style={{ ...m.style, borderColor: "currentColor", opacity: 0.9 }}
    >
      {m.label}
    </span>
  );
}

interface AiModelsProps {
  tenantId: string;
}

export default function AiModels({ tenantId }: AiModelsProps) {
  const [activeTab, setActiveTab] = useState<"config" | "usage" | "logs">("config");
  const qc = useQueryClient();

  const { data: catalog } = useQuery<AiModelCatalog>({
    queryKey: ["/api/tenants", tenantId, "ai", "catalog"],
    queryFn: () =>
      fetch(`/api/tenants/${tenantId}/ai/catalog`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: configs, isLoading: configsLoading } = useQuery<TenantAiModelConfig[]>({
    queryKey: ["/api/tenants", tenantId, "ai", "model-configs"],
    queryFn: () =>
      fetch(`/api/tenants/${tenantId}/ai/model-configs`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: usageStats, isLoading: usageLoading } = useQuery<AiUsageStats>({
    queryKey: ["/api/tenants", tenantId, "ai", "usage"],
    queryFn: () =>
      fetch(`/api/tenants/${tenantId}/ai/usage`, { credentials: "include" }).then((r) => r.json()),
    enabled: activeTab === "usage" || activeTab === "logs",
  });

  const updateConfig = useMutation({
    mutationFn: async ({ feature, body }: { feature: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/tenants/${tenantId}/ai/model-configs/${feature}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tenants", tenantId, "ai", "model-configs"] });
    },
  });

  const tabs = [
    { key: "config" as const, label: "Model Configuration", icon: Cpu },
    { key: "usage" as const, label: "Usage Dashboard", icon: BarChart3 },
    { key: "logs" as const, label: "Recent Calls", icon: Clock },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "var(--boa-ink-3)" }}>
          Administration · AI Models
        </div>
        <h1 className="boa-display text-3xl mb-2" style={{ color: "var(--boa-ink)" }}>
          AI Provider Management
        </h1>
        <p className="text-[14px] max-w-xl" style={{ color: "var(--boa-ink-3)" }}>
          Specify which language models power each Quorum feature, set per-token cost rates, and
          monitor usage across all board sessions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] border-b-2 transition-colors -mb-px"
            style={{
              borderBottomColor: activeTab === key ? "var(--boa-brass)" : "transparent",
              color: activeTab === key ? "var(--boa-ink)" : "var(--boa-ink-3)",
              fontWeight: activeTab === key ? 600 : 400,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Model Configuration ── */}
      {activeTab === "config" && (
        <ModelConfigTab
          configs={configs}
          catalog={catalog}
          loading={configsLoading}
          onSave={(feature, body) => updateConfig.mutate({ feature, body })}
          saving={updateConfig.isPending}
        />
      )}

      {/* ── Tab: Usage Dashboard ── */}
      {activeTab === "usage" && (
        <UsageDashboardTab stats={usageStats} loading={usageLoading} />
      )}

      {/* ── Tab: Recent Calls ── */}
      {activeTab === "logs" && (
        <RecentCallsTab logs={usageStats?.recentLogs} loading={usageLoading} />
      )}
    </div>
  );
}

/* ── Model Configuration Tab ─────────────────────────────────── */

interface ModelConfigTabProps {
  configs: TenantAiModelConfig[] | undefined;
  catalog: AiModelCatalog | undefined;
  loading: boolean;
  onSave: (feature: string, body: Record<string, unknown>) => void;
  saving: boolean;
}

function ModelConfigTab({ configs, catalog, loading, onSave, saving }: ModelConfigTabProps) {
  if (loading || !configs) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-lg border border-border animate-pulse"
            style={{ background: "var(--boa-paper-2)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-lg border border-border p-4 flex items-start gap-3"
        style={{ background: "var(--boa-paper-2)" }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--boa-brass)" }} />
        <p className="text-[13px]" style={{ color: "var(--boa-ink-2)" }}>
          Costs are stored in <strong>microdollars per million tokens</strong> (μ$/M). For example,
          $3.00/M input = <code className="boa-mono text-[11px]">3000</code> μ$/M. These rates are
          used to estimate spend on the Usage Dashboard. They do not affect billing — they are for
          monitoring only.
        </p>
      </div>

      {configs.map((config) => (
        <FeatureCard
          key={config.feature}
          config={config}
          catalog={catalog}
          onSave={onSave}
          saving={saving}
        />
      ))}

      {/* Model catalog reference */}
      {catalog && (
        <ModelCatalogReference models={catalog.models} />
      )}
    </div>
  );
}

function FeatureCard({
  config,
  catalog,
  onSave,
  saving,
}: {
  config: TenantAiModelConfig;
  catalog: AiModelCatalog | undefined;
  onSave: (feature: string, body: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const meta = FEATURE_META[config.feature];
  const Icon = meta?.icon ?? Brain;

  const [selectedModelId, setSelectedModelId] = useState(config.modelId);
  const [promptCost, setPromptCost] = useState(String(config.promptCostPerMToken));
  const [completionCost, setCompletionCost] = useState(String(config.completionCostPerMToken));
  const [maxTokens, setMaxTokens] = useState(String(config.maxTokens));
  const [enabled, setEnabled] = useState(config.enabled);

  const selectedModel = catalog?.models.find((m) => m.modelId === selectedModelId);

  const isDirty =
    selectedModelId !== config.modelId ||
    promptCost !== String(config.promptCostPerMToken) ||
    completionCost !== String(config.completionCostPerMToken) ||
    maxTokens !== String(config.maxTokens) ||
    enabled !== config.enabled;

  function handleModelChange(modelId: string) {
    setSelectedModelId(modelId);
    const m = catalog?.models.find((x) => x.modelId === modelId);
    if (m) {
      setPromptCost(String(m.promptCostPerMToken));
      setCompletionCost(String(m.completionCostPerMToken));
    }
  }

  function handleSave() {
    onSave(config.feature, {
      provider: selectedModel?.provider ?? config.provider,
      modelId: selectedModelId,
      promptCostPerMToken: parseInt(promptCost) || 0,
      completionCostPerMToken: parseInt(completionCost) || 0,
      maxTokens: parseInt(maxTokens) || 4096,
      enabled,
    });
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--boa-paper)",
    borderColor: "var(--boa-rule)",
    color: "var(--boa-ink)",
  };

  const modelsByProvider = catalog?.models.reduce<Record<string, AiModelInfo[]>>(
    (acc, m) => {
      (acc[m.provider] ??= []).push(m);
      return acc;
    },
    {},
  ) ?? {};

  return (
    <div
      className="rounded-lg border border-border overflow-hidden"
      style={{ background: "var(--boa-paper)" }}
    >
      {/* Feature header */}
      <div
        className="px-5 py-4 border-b border-border flex items-center gap-3"
        style={{ background: "var(--boa-paper-2)" }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
          style={{ background: "var(--boa-brass-2)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "var(--boa-brass)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold" style={{ color: "var(--boa-ink)" }}>
            {meta?.label ?? formatFeature(config.feature)}
          </div>
          <div className="text-[12px]" style={{ color: "var(--boa-ink-3)" }}>
            {meta?.description}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEnabled((v) => !v)}
            className="flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-sm border transition-colors"
            style={{
              borderColor: enabled ? "var(--boa-brass)" : "var(--boa-rule)",
              color: enabled ? "var(--boa-brass)" : "var(--boa-ink-3)",
              background: enabled ? "var(--boa-brass-2)" : "transparent",
            }}
          >
            {enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {enabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {/* Config body */}
      <div className="px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Model selector */}
        <div className="flex flex-col gap-1.5">
          <label className="boa-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
            Model
          </label>
          <select
            value={selectedModelId}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full px-3 py-2 text-[13px] rounded-sm border outline-none"
            style={inputStyle}
          >
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <optgroup key={provider} label={providerLabel(provider)}>
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedModel && (
            <div className="flex items-center gap-2 mt-0.5">
              {costTierDot(selectedModel.costTier)}
              <span className="text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
                {selectedModel.description}
              </span>
            </div>
          )}
        </div>

        {/* Max tokens */}
        <div className="flex flex-col gap-1.5">
          <label className="boa-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
            Max Tokens / Request
          </label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            min={256}
            max={200000}
            className="w-full px-3 py-2 text-[13px] rounded-sm border outline-none"
            style={inputStyle}
          />
          {selectedModel && (
            <div className="text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
              Context window: {formatTokens(selectedModel.contextWindow)} tokens
            </div>
          )}
        </div>

        {/* Prompt cost */}
        <div className="flex flex-col gap-1.5">
          <label className="boa-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
            Input cost (μ$/M tokens)
          </label>
          <input
            type="number"
            value={promptCost}
            onChange={(e) => setPromptCost(e.target.value)}
            min={0}
            className="w-full px-3 py-2 text-[13px] rounded-sm border outline-none"
            style={inputStyle}
          />
          <div className="text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
            = ${(parseInt(promptCost) / 1000).toFixed(4)} per 1K tokens
          </div>
        </div>

        {/* Completion cost */}
        <div className="flex flex-col gap-1.5">
          <label className="boa-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
            Output cost (μ$/M tokens)
          </label>
          <input
            type="number"
            value={completionCost}
            onChange={(e) => setCompletionCost(e.target.value)}
            min={0}
            className="w-full px-3 py-2 text-[13px] rounded-sm border outline-none"
            style={inputStyle}
          />
          <div className="text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
            = ${(parseInt(completionCost) / 1000).toFixed(4)} per 1K tokens
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t border-border flex items-center justify-between"
        style={{ background: "var(--boa-paper-2)" }}
      >
        <div className="boa-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--boa-ink-3)" }}>
          Last updated {new Date(config.updatedAt).toLocaleDateString()}
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="boa-cta flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-[12px] font-medium tracking-wide transition-opacity disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function ModelCatalogReference({ models }: { models: AiModelInfo[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden" style={{ background: "var(--boa-paper)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: "var(--boa-ink-3)" }} />
          <span className="text-[13px] font-medium" style={{ color: "var(--boa-ink)" }}>
            Model catalog &amp; cost reference
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--boa-ink-3)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--boa-ink-3)" }} />
        )}
      </button>

      {open && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: "var(--boa-paper-2)" }}>
                {["Provider", "Model", "Context", "Input ($/M)", "Output ($/M)", "Tier"].map((h) => (
                  <th
                    key={h}
                    className="boa-mono text-[10px] uppercase tracking-[0.12em] px-4 py-2.5 text-left"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr
                  key={m.modelId}
                  className="border-t border-border hover:bg-accent/20 transition-colors"
                >
                  <td className="px-4 py-2.5 boa-mono text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
                    {providerLabel(m.provider)}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--boa-ink)" }}>
                    {m.displayName}
                    <div className="boa-mono text-[10px] mt-0.5" style={{ color: "var(--boa-ink-3)" }}>
                      {m.modelId}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 boa-mono" style={{ color: "var(--boa-ink-2)" }}>
                    {formatTokens(m.contextWindow)}
                  </td>
                  <td className="px-4 py-2.5 boa-mono" style={{ color: "var(--boa-ink-2)" }}>
                    ${(m.promptCostPerMToken / 1000).toFixed(3)}
                  </td>
                  <td className="px-4 py-2.5 boa-mono" style={{ color: "var(--boa-ink-2)" }}>
                    ${(m.completionCostPerMToken / 1000).toFixed(3)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {costTierDot(m.costTier)}
                      {costTierLabel(m.costTier)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Usage Dashboard Tab ──────────────────────────────────────── */

function UsageDashboardTab({ stats, loading }: { stats: AiUsageStats | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 rounded-lg border border-border animate-pulse"
            style={{ background: "var(--boa-paper-2)" }}
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const featureEntries = Object.entries(stats.byFeature).sort((a, b) => b[1].requests - a[1].requests);
  const modelEntries = Object.entries(stats.byModel).sort((a, b) => b[1].requests - a[1].requests);
  const maxDayReqs = stats.dailyUsage.length
    ? Math.max(...stats.dailyUsage.map((d) => d.requests))
    : 1;

  const periodStart = new Date(stats.period.start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const periodEnd = new Date(stats.period.end).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const statCards = [
    { label: "Total Requests", value: formatNumber(stats.totalRequests), icon: Activity },
    { label: "Total Tokens", value: formatTokens(stats.totalTokens), icon: Cpu },
    { label: "Estimated Cost", value: formatMicrodollars(stats.totalCostMicrodollars), icon: DollarSign },
    {
      label: "Avg Tokens/Call",
      value: stats.totalRequests > 0 ? formatNumber(Math.round(stats.totalTokens / stats.totalRequests)) : "—",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Period label */}
      <div className="boa-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
        Showing {periodStart} – {periodEnd} (last 30 days)
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-border px-4 py-4"
            style={{ background: "var(--boa-paper)" }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="w-3.5 h-3.5" style={{ color: "var(--boa-ink-3)" }} />
              <span className="boa-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--boa-ink-3)" }}>
                {label}
              </span>
            </div>
            <div className="boa-display text-2xl" style={{ color: "var(--boa-ink)" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* By feature + by model side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border p-5" style={{ background: "var(--boa-paper)" }}>
          <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--boa-ink-3)" }}>
            Usage by Feature
          </div>
          {featureEntries.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>No usage recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {featureEntries.map(([feature, data]) => {
                const maxReqs = featureEntries[0][1].requests;
                const pct = maxReqs > 0 ? (data.requests / maxReqs) * 100 : 0;
                return (
                  <div key={feature}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px]" style={{ color: "var(--boa-ink)" }}>
                        {formatFeature(feature)}
                      </span>
                      <span className="boa-mono text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
                        {data.requests} req · {formatMicrodollars(data.costMicrodollars)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--boa-rule)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: "var(--boa-brass)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-5" style={{ background: "var(--boa-paper)" }}>
          <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--boa-ink-3)" }}>
            Usage by Model
          </div>
          {modelEntries.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>No usage recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {modelEntries.map(([modelId, data]) => {
                const maxReqs = modelEntries[0][1].requests;
                const pct = maxReqs > 0 ? (data.requests / maxReqs) * 100 : 0;
                return (
                  <div key={modelId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="boa-mono text-[11px]" style={{ color: "var(--boa-ink)" }}>
                        {modelId}
                      </span>
                      <span className="boa-mono text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
                        {formatTokens(data.tokens)} tok
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--boa-rule)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: "var(--boa-aubergine)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Daily bar chart */}
      {stats.dailyUsage.length > 0 && (
        <div className="rounded-lg border border-border p-5" style={{ background: "var(--boa-paper)" }}>
          <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-5" style={{ color: "var(--boa-ink-3)" }}>
            Daily Activity — Last 30 Days
          </div>
          <div className="flex items-end gap-1 h-28 overflow-x-auto">
            {stats.dailyUsage.map((day) => {
              const pct = maxDayReqs > 0 ? (day.requests / maxDayReqs) * 100 : 0;
              const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <div key={day.date} className="flex flex-col items-center gap-1 flex-1 min-w-[12px] group">
                  <div className="relative w-full flex flex-col items-center justify-end h-20">
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(pct, 4)}%`,
                        background: day.requests > 0 ? "var(--boa-brass)" : "var(--boa-rule)",
                        opacity: day.requests > 0 ? 1 : 0.4,
                      }}
                      title={`${dateLabel}: ${day.requests} req, ${formatTokens(day.tokens)} tokens`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="boa-mono text-[9px]" style={{ color: "var(--boa-ink-3)" }}>
              {stats.dailyUsage[0]
                ? new Date(stats.dailyUsage[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : ""}
            </span>
            <span className="boa-mono text-[9px]" style={{ color: "var(--boa-ink-3)" }}>
              {stats.dailyUsage[stats.dailyUsage.length - 1]
                ? new Date(stats.dailyUsage[stats.dailyUsage.length - 1].date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : ""}
            </span>
          </div>
        </div>
      )}

      {stats.totalRequests === 0 && (
        <div
          className="rounded-lg border border-border p-10 text-center"
          style={{ background: "var(--boa-paper)" }}
        >
          <Brain className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--boa-ink-3)" }} />
          <p className="text-[14px] font-medium mb-1" style={{ color: "var(--boa-ink)" }}>No AI usage yet</p>
          <p className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>
            Usage data will appear here once board sessions are run.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Recent Calls Tab ─────────────────────────────────────────── */

function RecentCallsTab({ logs, loading }: { logs: AiUsageLogEntry[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded border border-border animate-pulse"
            style={{ background: "var(--boa-paper-2)" }}
          />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div
        className="rounded-lg border border-border p-10 text-center"
        style={{ background: "var(--boa-paper)" }}
      >
        <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--boa-ink-3)" }} />
        <p className="text-[14px] font-medium mb-1" style={{ color: "var(--boa-ink)" }}>No calls recorded</p>
        <p className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>
          Individual LLM call logs will appear here once sessions are run.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden" style={{ background: "var(--boa-paper)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: "var(--boa-paper-2)" }}>
              {["Time", "Feature", "Model", "Tokens", "Cost", "Latency", "Status"].map((h) => (
                <th
                  key={h}
                  className="boa-mono text-[10px] uppercase tracking-[0.12em] px-4 py-3 text-left"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-t border-border hover:bg-accent/20 transition-colors"
              >
                <td className="px-4 py-2.5 boa-mono text-[11px] whitespace-nowrap" style={{ color: "var(--boa-ink-3)" }}>
                  {new Date(log.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--boa-ink)" }}>
                  {formatFeature(log.feature)}
                </td>
                <td className="px-4 py-2.5 boa-mono text-[11px]" style={{ color: "var(--boa-ink-2)" }}>
                  {log.modelId}
                </td>
                <td className="px-4 py-2.5 boa-mono text-[11px]" style={{ color: "var(--boa-ink-2)" }}>
                  <span title={`${log.promptTokens} in / ${log.completionTokens} out`}>
                    {formatTokens(log.totalTokens)}
                  </span>
                </td>
                <td className="px-4 py-2.5 boa-mono text-[11px]" style={{ color: "var(--boa-ink-2)" }}>
                  {log.estimatedCostMicrodollars != null
                    ? formatMicrodollars(log.estimatedCostMicrodollars)
                    : "—"}
                </td>
                <td className="px-4 py-2.5 boa-mono text-[11px]" style={{ color: "var(--boa-ink-2)" }}>
                  {log.latencyMs != null ? `${(log.latencyMs / 1000).toFixed(1)}s` : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {log.success ? (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="boa-mono text-[10px] uppercase tracking-[0.1em] text-green-600 dark:text-green-400">
                        OK
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1" title={log.errorCode ?? undefined}>
                      <XCircle className="w-3 h-3 text-red-500" />
                      <span className="boa-mono text-[10px] uppercase tracking-[0.1em] text-red-600 dark:text-red-400">
                        {log.errorCode ?? "ERR"}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────  */

function providerLabel(provider: string) {
  const map: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
  };
  return map[provider] ?? provider;
}
