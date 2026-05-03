import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./auth";

export const groundingDocumentsTable = pgTable(
  "grounding_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: varchar("content_type", { length: 128 }).notNull(),
    storagePath: text("storage_path").notNull(),
    extractedText: text("extracted_text").notNull().default(""),
    characterCount: integer("character_count").notNull().default(0),
    truncated: boolean("truncated").notNull().default(false),
    uploadedBy: varchar("uploaded_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (t) => [index("idx_grounding_docs_tenant").on(t.tenantId)],
);

export type GroundingDocument = typeof groundingDocumentsTable.$inferSelect;
export type InsertGroundingDocument = typeof groundingDocumentsTable.$inferInsert;
