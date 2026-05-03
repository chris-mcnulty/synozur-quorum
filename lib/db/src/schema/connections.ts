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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_grounding_sel_board").on(t.boardId),
    index("idx_grounding_sel_member").on(t.boardMemberId),
    index("idx_grounding_sel_tenant").on(t.tenantId),
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
