import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { groundingDocumentsTable } from "./grounding";

export const tenantAdvisorsTable = pgTable(
  "tenant_advisors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleTitle: text("role_title").notNull(),
    lensDescription: text("lens_description"),
    instructionsText: text("instructions_text").notNull().default(""),
    groundingDocumentId: uuid("grounding_document_id").references(
      () => groundingDocumentsTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_tenant_advisors_tenant").on(t.tenantId)],
);

export type TenantAdvisor = typeof tenantAdvisorsTable.$inferSelect;
export type InsertTenantAdvisor = typeof tenantAdvisorsTable.$inferInsert;
