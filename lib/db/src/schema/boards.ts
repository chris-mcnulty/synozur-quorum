import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  varchar,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { groundingDocumentsTable } from "./grounding";
import { usersTable } from "./auth";

export const boardsTable = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    topicArea: text("topic_area"),
    masterInstructionsText: text("master_instructions_text").notNull(),
    size: integer("size").notNull().default(5),
    defaultMemberModel: varchar("default_member_model", { length: 64 }).notNull(),
    defaultMasterModel: varchar("default_master_model", { length: 64 }).notNull(),
    temperature: numeric("temperature", { precision: 3, scale: 2 })
      .notNull()
      .default("0.70"),
    createdBy: varchar("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_boards_tenant").on(t.tenantId)],
);

export const boardMembersTable = pgTable(
  "board_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boardsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleTitle: text("role_title").notNull(),
    lensDescription: text("lens_description"),
    instructionsText: text("instructions_text").notNull(),
    groundingDocumentId: uuid("grounding_document_id").references(
      () => groundingDocumentsTable.id,
      { onDelete: "set null" },
    ),
    modelOverride: varchar("model_override", { length: 64 }),
    ordering: integer("ordering").notNull().default(0),
    fromPresetSlug: varchar("from_preset_slug", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_board_members_board").on(t.boardId)],
);

export type Board = typeof boardsTable.$inferSelect;
export type BoardMember = typeof boardMembersTable.$inferSelect;
export type InsertBoard = typeof boardsTable.$inferInsert;
export type InsertBoardMember = typeof boardMembersTable.$inferInsert;
