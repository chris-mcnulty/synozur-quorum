import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { boardsTable } from "./boards";
import { advisorySessionsTable } from "./sessions";
import { usersTable } from "./auth";

export const decisionsTable = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boardsTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .unique()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    recommendationText: text("recommendation_text"),
    voteYes: integer("vote_yes").notNull().default(0),
    voteNo: integer("vote_no").notNull().default(0),
    voteAbstain: integer("vote_abstain").notNull().default(0),
    // PENDING | ACTED | DECLINED | OVERRIDDEN
    status: varchar("status", { length: 16 }).notNull().default("PENDING"),
    decidedAt: timestamp("decided_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_decisions_tenant").on(t.tenantId),
    index("idx_decisions_board").on(t.boardId),
  ],
);

export const decisionOutcomesTable = pgTable(
  "decision_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionId: uuid("decision_id")
      .notNull()
      .unique()
      .references(() => decisionsTable.id, { onDelete: "cascade" }),
    // WIN | LOSS | MIXED | TOO_EARLY
    tag: varchar("tag", { length: 16 }).notNull(),
    noteText: text("note_text"),
    recordedBy: varchar("recorded_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export type Decision = typeof decisionsTable.$inferSelect;
export type DecisionOutcome = typeof decisionOutcomesTable.$inferSelect;
export type InsertDecision = typeof decisionsTable.$inferInsert;
export type InsertDecisionOutcome = typeof decisionOutcomesTable.$inferInsert;
