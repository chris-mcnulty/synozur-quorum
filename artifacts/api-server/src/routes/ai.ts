import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tenantAiModelConfigsTable,
  aiUsageLogsTable,
  AI_MODEL_CATALOG,
  AI_FEATURES,
  AI_FEATURE_DEFAULTS,
  type AiFeature,
} from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireTenantRole } from "../lib/tenantAuth";

const router: IRouter = Router();

function catalogModelInfo(modelId: string) {
  return AI_MODEL_CATALOG.find((m) => m.modelId === modelId) ?? null;
}

function serializeConfig(row: typeof tenantAiModelConfigsTable.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    feature: row.feature,
    provider: row.provider,
    modelId: row.modelId,
    promptCostPerMToken: row.promptCostPerMToken,
    completionCostPerMToken: row.completionCostPerMToken,
    maxTokens: row.maxTokens,
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    modelInfo: catalogModelInfo(row.modelId),
  };
}

async function ensureDefaultConfigs(tenantId: string) {
  const existing = await db
    .select({ feature: tenantAiModelConfigsTable.feature })
    .from(tenantAiModelConfigsTable)
    .where(eq(tenantAiModelConfigsTable.tenantId, tenantId));

  const existingFeatures = new Set(existing.map((r) => r.feature));

  for (const feature of AI_FEATURES) {
    if (existingFeatures.has(feature)) continue;
    const defaults = AI_FEATURE_DEFAULTS[feature];
    const modelInfo = catalogModelInfo(defaults.modelId);
    await db
      .insert(tenantAiModelConfigsTable)
      .values({
        tenantId,
        feature,
        provider: defaults.provider,
        modelId: defaults.modelId,
        promptCostPerMToken: modelInfo?.promptCostPerMToken ?? 0,
        completionCostPerMToken: modelInfo?.completionCostPerMToken ?? 0,
        maxTokens: defaults.maxTokens,
        enabled: true,
      })
      .onConflictDoNothing();
  }
}

router.get("/tenants/:tenantId/ai/catalog", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  res.json({
    models: AI_MODEL_CATALOG,
    features: AI_FEATURES,
  });
});

router.get("/tenants/:tenantId/ai/model-configs", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  await ensureDefaultConfigs(tenantId);

  const rows = await db
    .select()
    .from(tenantAiModelConfigsTable)
    .where(eq(tenantAiModelConfigsTable.tenantId, tenantId))
    .orderBy(tenantAiModelConfigsTable.feature);

  res.json(rows.map(serializeConfig));
});

router.put("/tenants/:tenantId/ai/model-configs/:feature", async (req: Request, res: Response) => {
  const { tenantId, feature } = req.params;
  const ctx = await requireTenantRole(req, res, tenantId, "EDITOR");
  if (!ctx) return;

  if (!AI_FEATURES.includes(feature as AiFeature)) {
    res.status(400).json({ error: `Unknown feature: ${feature}` });
    return;
  }

  const { provider, modelId, promptCostPerMToken, completionCostPerMToken, maxTokens, enabled } =
    req.body as {
      provider?: string;
      modelId?: string;
      promptCostPerMToken?: number;
      completionCostPerMToken?: number;
      maxTokens?: number;
      enabled?: boolean;
    };

  const defaults = AI_FEATURE_DEFAULTS[feature as AiFeature];
  const baseModelInfo = modelId ? catalogModelInfo(modelId) : null;

  const values = {
    tenantId,
    feature,
    provider: provider ?? defaults.provider,
    modelId: modelId ?? defaults.modelId,
    promptCostPerMToken:
      promptCostPerMToken ?? baseModelInfo?.promptCostPerMToken ?? 0,
    completionCostPerMToken:
      completionCostPerMToken ?? baseModelInfo?.completionCostPerMToken ?? 0,
    maxTokens: maxTokens ?? defaults.maxTokens,
    enabled: enabled ?? true,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(tenantAiModelConfigsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [tenantAiModelConfigsTable.tenantId, tenantAiModelConfigsTable.feature],
      set: {
        provider: values.provider,
        modelId: values.modelId,
        promptCostPerMToken: values.promptCostPerMToken,
        completionCostPerMToken: values.completionCostPerMToken,
        maxTokens: values.maxTokens,
        enabled: values.enabled,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  res.json(serializeConfig(row));
});

router.get("/tenants/:tenantId/ai/usage", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const logs = await db
    .select()
    .from(aiUsageLogsTable)
    .where(
      and(
        eq(aiUsageLogsTable.tenantId, tenantId),
        gte(aiUsageLogsTable.createdAt, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(aiUsageLogsTable.createdAt));

  const totalRequests = logs.length;
  const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
  const totalCostMicrodollars = logs.reduce(
    (s, l) => s + (l.estimatedCostMicrodollars ?? 0),
    0,
  );

  const byFeature: Record<string, { requests: number; tokens: number; costMicrodollars: number }> = {};
  const byModel: Record<string, { requests: number; tokens: number; costMicrodollars: number }> = {};

  for (const l of logs) {
    const f = (byFeature[l.feature] ??= { requests: 0, tokens: 0, costMicrodollars: 0 });
    f.requests++;
    f.tokens += l.totalTokens;
    f.costMicrodollars += l.estimatedCostMicrodollars ?? 0;

    const m = (byModel[l.modelId] ??= { requests: 0, tokens: 0, costMicrodollars: 0 });
    m.requests++;
    m.tokens += l.totalTokens;
    m.costMicrodollars += l.estimatedCostMicrodollars ?? 0;
  }

  const dailyMap: Record<string, { requests: number; tokens: number; costMicrodollars: number }> = {};
  for (const l of logs) {
    const dateKey = l.createdAt.toISOString().slice(0, 10);
    const d = (dailyMap[dateKey] ??= { requests: 0, tokens: 0, costMicrodollars: 0 });
    d.requests++;
    d.tokens += l.totalTokens;
    d.costMicrodollars += l.estimatedCostMicrodollars ?? 0;
  }

  const dailyUsage = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  const recentLogs = logs.slice(0, 50).map((l) => ({
    id: l.id,
    tenantId: l.tenantId,
    sessionId: l.sessionId,
    feature: l.feature,
    provider: l.provider,
    modelId: l.modelId,
    promptTokens: l.promptTokens,
    completionTokens: l.completionTokens,
    totalTokens: l.totalTokens,
    estimatedCostMicrodollars: l.estimatedCostMicrodollars,
    latencyMs: l.latencyMs,
    success: l.success,
    errorCode: l.errorCode,
    createdAt: l.createdAt.toISOString(),
  }));

  res.json({
    period: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() },
    totalRequests,
    totalTokens,
    totalCostMicrodollars,
    totalCostDollars: totalCostMicrodollars / 1_000_000,
    byFeature,
    byModel,
    dailyUsage,
    recentLogs,
  });
});

router.get("/tenants/:tenantId/ai/usage/logs", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const logs = await db
    .select()
    .from(aiUsageLogsTable)
    .where(eq(aiUsageLogsTable.tenantId, tenantId))
    .orderBy(desc(aiUsageLogsTable.createdAt))
    .limit(limit);

  res.json(
    logs.map((l) => ({
      id: l.id,
      tenantId: l.tenantId,
      sessionId: l.sessionId,
      feature: l.feature,
      provider: l.provider,
      modelId: l.modelId,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      estimatedCostMicrodollars: l.estimatedCostMicrodollars,
      latencyMs: l.latencyMs,
      success: l.success,
      errorCode: l.errorCode,
      createdAt: l.createdAt.toISOString(),
    })),
  );
});

export default router;
