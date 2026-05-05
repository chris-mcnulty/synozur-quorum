import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { advisorySessionsTable } from "./sessions";

export const AI_FEATURES = [
  "advisor_deliberation",
  "chair_synthesis",
  "cross_exam_synthesis",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiModelInfo {
  provider: AiProvider;
  modelId: string;
  displayName: string;
  contextWindow: number;
  promptCostPerMToken: number;
  completionCostPerMToken: number;
  costTier: "free" | "low" | "medium" | "high";
  description: string;
}

export const AI_MODEL_CATALOG: AiModelInfo[] = [
  {
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    contextWindow: 200000,
    promptCostPerMToken: 800,
    completionCostPerMToken: 4000,
    costTier: "low",
    description: "Fast and compact — ideal for high-volume advisor deliberation",
  },
  {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    contextWindow: 200000,
    promptCostPerMToken: 3000,
    completionCostPerMToken: 15000,
    costTier: "medium",
    description: "Balanced intelligence — the recommended chair synthesis model",
  },
  {
    provider: "anthropic",
    modelId: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    contextWindow: 200000,
    promptCostPerMToken: 15000,
    completionCostPerMToken: 75000,
    costTier: "high",
    description: "Maximum reasoning depth — cross-examination synthesis and meta-analysis",
  },
  {
    provider: "anthropic",
    modelId: "claude-opus-4-5",
    displayName: "Claude Opus 4.5",
    contextWindow: 200000,
    promptCostPerMToken: 15000,
    completionCostPerMToken: 75000,
    costTier: "high",
    description: "Previous generation flagship — broad context, deep reasoning",
  },
  {
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    contextWindow: 128000,
    promptCostPerMToken: 2500,
    completionCostPerMToken: 10000,
    costTier: "medium",
    description: "OpenAI flagship multimodal model",
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    contextWindow: 128000,
    promptCostPerMToken: 150,
    completionCostPerMToken: 600,
    costTier: "low",
    description: "Cost-efficient OpenAI model for simpler tasks",
  },
  {
    provider: "google",
    modelId: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    contextWindow: 1000000,
    promptCostPerMToken: 75,
    completionCostPerMToken: 300,
    costTier: "low",
    description: "Ultra-fast Google model with 1M token context window",
  },
  {
    provider: "google",
    modelId: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    contextWindow: 2000000,
    promptCostPerMToken: 1250,
    completionCostPerMToken: 5000,
    costTier: "medium",
    description: "Google's balanced model with an enormous 2M token context",
  },
];

export const AI_FEATURE_DEFAULTS: Record<AiFeature, { modelId: string; provider: AiProvider; maxTokens: number }> = {
  advisor_deliberation: {
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    maxTokens: 4096,
  },
  chair_synthesis: {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    maxTokens: 8192,
  },
  cross_exam_synthesis: {
    provider: "anthropic",
    modelId: "claude-opus-4-7",
    maxTokens: 16384,
  },
};

export const tenantAiModelConfigsTable = pgTable(
  "tenant_ai_model_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull().default("anthropic"),
    modelId: text("model_id").notNull(),
    promptCostPerMToken: integer("prompt_cost_per_m_token").notNull().default(0),
    completionCostPerMToken: integer("completion_cost_per_m_token").notNull().default(0),
    maxTokens: integer("max_tokens").notNull().default(4096),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("uq_tenant_ai_feature").on(t.tenantId, t.feature),
    index("idx_tenant_ai_configs_tenant").on(t.tenantId),
  ],
);

export type TenantAiModelConfig = typeof tenantAiModelConfigsTable.$inferSelect;
export type InsertTenantAiModelConfig = typeof tenantAiModelConfigsTable.$inferInsert;

export const aiUsageLogsTable = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => advisorySessionsTable.id, {
      onDelete: "set null",
    }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    modelId: text("model_id").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    estimatedCostMicrodollars: integer("estimated_cost_microdollars"),
    latencyMs: integer("latency_ms"),
    success: boolean("success").notNull().default(true),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_ai_usage_tenant").on(t.tenantId),
    index("idx_ai_usage_feature").on(t.feature),
    index("idx_ai_usage_created").on(t.createdAt),
  ],
);

export type AiUsageLog = typeof aiUsageLogsTable.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLogsTable.$inferInsert;
