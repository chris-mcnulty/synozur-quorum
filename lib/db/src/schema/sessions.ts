import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  varchar,
  index,
  boolean,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { boardsTable, boardMembersTable } from "./boards";
import { tenantsTable } from "./tenants";
import { usersTable } from "./auth";

export const advisorySessionsTable = pgTable(
  "advisory_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boardsTable.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 16 }).notNull(), // ADVISORY | BOARD | REVIEW
    questionText: text("question_text").notNull(),
    establishedFactsText: text("established_facts_text"),
    status: varchar("status", { length: 16 }).notNull().default("running"),
    totalCostCents: integer("total_cost_cents"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    createdBy: varchar("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    parentSessionId: uuid("parent_session_id").references(
      (): AnyPgColumn => advisorySessionsTable.id,
      { onDelete: "set null" },
    ),
    branchNote: text("branch_note"),
    allHands: boolean("all_hands").notNull().default(false),
  },
  (t) => [
    index("idx_sessions_board").on(t.boardId),
    index("idx_sessions_tenant").on(t.tenantId),
    index("idx_sessions_parent").on(t.parentSessionId),
  ],
);

export const sessionContributionsTable = pgTable(
  "session_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    boardMemberId: uuid("board_member_id").references(
      () => boardMembersTable.id,
      { onDelete: "set null" },
    ),
    memberName: text("member_name"),
    memberRoleTitle: text("member_role_title"),
    contributionText: text("contribution_text"),
    vote: varchar("vote", { length: 8 }),
    voteRationale: text("vote_rationale"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_contribs_session").on(t.sessionId)],
);

export const sessionSummariesTable = pgTable(
  "session_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .unique()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    chairsFraming: text("chairs_framing"),
    convergenceNote: text("convergence_note"),
    openQuestionsText: text("open_questions_text"),
    finalSummary: text("final_summary"),
    flagsRaisedText: text("flags_raised_text"),
    totalCostCents: integer("total_cost_cents"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export const sessionCommentsTable = pgTable(
  "session_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    anchorType: varchar("anchor_type", { length: 16 }).notNull(),
    anchorId: varchar("anchor_id", { length: 64 }).notNull().default(""),
    parentCommentId: uuid("parent_comment_id"),
    bodyText: text("body_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_session_comments_session").on(t.sessionId),
    index("idx_session_comments_anchor").on(t.sessionId, t.anchorType, t.anchorId),
  ],
);

export const sessionReactionsTable = pgTable(
  "session_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    anchorType: varchar("anchor_type", { length: 16 }).notNull(),
    anchorId: varchar("anchor_id", { length: 64 }).notNull().default(""),
    reactionKind: varchar("reaction_kind", { length: 16 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_session_reactions_session").on(t.sessionId),
  ],
);

export const followUpProposalsTable = pgTable(
  "follow_up_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    dispatchedSessionId: uuid("dispatched_session_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_follow_up_proposals_session").on(t.sessionId)],
);

export type AdvisorySession = typeof advisorySessionsTable.$inferSelect;
export type SessionContribution = typeof sessionContributionsTable.$inferSelect;
export type SessionSummaryRow = typeof sessionSummariesTable.$inferSelect;
export type SessionComment = typeof sessionCommentsTable.$inferSelect;
export type SessionReaction = typeof sessionReactionsTable.$inferSelect;
export type FollowUpProposal = typeof followUpProposalsTable.$inferSelect;
