import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  varchar,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { boardsTable, boardMembersTable } from "./boards";
import { advisorySessionsTable } from "./sessions";
import { usersTable } from "./auth";

export const GROUNDING_PROVIDERS = [
  "linear",
  "notion",
  "google-docs",
  "github",
  "slack",
  "jira",
  "hubspot",
] as const;
export type GroundingProvider = (typeof GROUNDING_PROVIDERS)[number];

export const tenantConnectionsTable = pgTable(
  "tenant_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    accountLabel: text("account_label"),
    enabledAt: timestamp("enabled_at").defaultNow().notNull(),
    enabledBy: varchar("enabled_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("uq_tenant_connections_provider").on(t.tenantId, t.provider),
  ],
);

export const groundingSelectorsTable = pgTable(
  "grounding_selectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    boardId: uuid("board_id").references(() => boardsTable.id, {
      onDelete: "cascade",
    }),
    boardMemberId: uuid("board_member_id").references(
      () => boardMembersTable.id,
      { onDelete: "cascade" },
    ),
    provider: varchar("provider", { length: 32 }).notNull(),
    name: text("name").notNull(),
    queryJson: jsonb("query_json").notNull(),
    tokenBudget: integer("token_budget").notNull().default(2000),
    ordering: integer("ordering").notNull().default(0),
    autoRefreshEnabled: boolean("auto_refresh_enabled").notNull().default(true),
    lastRefreshedAt: timestamp("last_refreshed_at"),
    lastContentHash: varchar("last_content_hash", { length: 64 }),
    lastTokenEstimate: integer("last_token_estimate"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_grounding_sel_board").on(t.boardId),
    index("idx_grounding_sel_member").on(t.boardMemberId),
    index("idx_grounding_sel_tenant").on(t.tenantId),
    index("idx_grounding_sel_auto_refresh").on(
      t.autoRefreshEnabled,
      t.lastRefreshedAt,
    ),
  ],
);

export const groundingRefreshDiffsTable = pgTable(
  "grounding_refresh_diffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    selectorId: uuid("selector_id")
      .notNull()
      .references(() => groundingSelectorsTable.id, { onDelete: "cascade" }),
    boardId: uuid("board_id").references(() => boardsTable.id, {
      onDelete: "cascade",
    }),
    boardMemberId: uuid("board_member_id").references(
      () => boardMembersTable.id,
      { onDelete: "cascade" },
    ),
    provider: varchar("provider", { length: 32 }).notNull(),
    selectorName: text("selector_name").notNull(),
    previousHash: varchar("previous_hash", { length: 64 }),
    newHash: varchar("new_hash", { length: 64 }).notNull(),
    previousTokenEstimate: integer("previous_token_estimate"),
    newTokenEstimate: integer("new_token_estimate").notNull().default(0),
    changeKind: varchar("change_kind", { length: 24 }).notNull(),
    materiallyChanged: boolean("materially_changed").notNull().default(false),
    fetchStatus: varchar("fetch_status", { length: 16 })
      .notNull()
      .default("ok"),
    errorDetail: text("error_detail"),
    contentSnippet: text("content_snippet").notNull().default(""),
    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedBy: varchar("acknowledged_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_grounding_diff_tenant").on(t.tenantId, t.acknowledgedAt),
    index("idx_grounding_diff_selector").on(t.selectorId),
    index("idx_grounding_diff_board").on(t.boardId),
  ],
);

export const sessionGroundingSnapshotsTable = pgTable(
  "session_grounding_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    selectorId: uuid("selector_id").references(
      () => groundingSelectorsTable.id,
      { onDelete: "set null" },
    ),
    boardMemberId: uuid("board_member_id").references(
      () => boardMembersTable.id,
      { onDelete: "set null" },
    ),
    provider: varchar("provider", { length: 32 }).notNull(),
    selectorName: text("selector_name").notNull(),
    queryJson: jsonb("query_json").notNull(),
    contentText: text("content_text").notNull().default(""),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    truncated: boolean("truncated").notNull().default(false),
    fetchStatus: varchar("fetch_status", { length: 16 })
      .notNull()
      .default("ok"),
    errorDetail: text("error_detail"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [index("idx_grounding_snap_session").on(t.sessionId)],
);

export type TenantConnection = typeof tenantConnectionsTable.$inferSelect;
export type GroundingSelector = typeof groundingSelectorsTable.$inferSelect;
export type SessionGroundingSnapshot =
  typeof sessionGroundingSnapshotsTable.$inferSelect;
export type GroundingRefreshDiff =
  typeof groundingRefreshDiffsTable.$inferSelect;

export const tenantNotificationsTable = pgTable(
  "tenant_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 48 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    refType: varchar("ref_type", { length: 48 }),
    refId: uuid("ref_id"),
    payload: jsonb("payload"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_tenant_notif_user_unread").on(t.userId, t.readAt),
    index("idx_tenant_notif_tenant").on(t.tenantId, t.createdAt),
  ],
);

export type TenantNotification = typeof tenantNotificationsTable.$inferSelect;
