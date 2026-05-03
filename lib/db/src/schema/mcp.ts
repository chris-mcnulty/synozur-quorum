import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./auth";

export const mcpApiKeysTable = pgTable(
  "mcp_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_mcp_api_keys_tenant").on(t.tenantId),
    index("idx_mcp_api_keys_hash").on(t.keyHash),
  ],
);

export const mcpOauthClientsTable = pgTable(
  "mcp_oauth_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull().unique(),
    clientSecretHash: varchar("client_secret_hash", { length: 128 }),
    redirectUris: jsonb("redirect_uris").$type<string[]>().notNull().default([]),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("idx_mcp_oauth_clients_tenant").on(t.tenantId)],
);

export type McpApiKey = typeof mcpApiKeysTable.$inferSelect;
export type McpOauthClient = typeof mcpOauthClientsTable.$inferSelect;

export const MCP_SCOPES = [
  "boards:read",
  "boards:write",
  "sessions:read",
  "sessions:write",
  "decisions:read",
  "decisions:write",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];
