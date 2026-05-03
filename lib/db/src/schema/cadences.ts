import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  varchar,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { boardsTable } from "./boards";
import { usersTable } from "./auth";
import { advisorySessionsTable } from "./sessions";

export const cadencesTable = pgTable(
  "cadences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boardsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    frequency: varchar("frequency", { length: 16 }).notNull(),
    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    hour: integer("hour").notNull(),
    minute: integer("minute").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    mode: varchar("mode", { length: 16 }).notNull().default("ADVISORY"),
    questionTemplate: text("question_template").notNull(),
    templateVariables: jsonb("template_variables")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
    paused: boolean("paused").notNull().default(false),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdBy: varchar("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_cadences_board").on(t.boardId),
    index("idx_cadences_tenant").on(t.tenantId),
    index("idx_cadences_next_run").on(t.nextRunAt),
  ],
);

export const cadenceRunsTable = pgTable(
  "cadence_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cadenceId: uuid("cadence_id")
      .notNull()
      .references(() => cadencesTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(
      () => advisorySessionsTable.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 16 }).notNull().default("running"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deliveryStatus: varchar("delivery_status", { length: 32 }),
    errorDetail: text("error_detail"),
  },
  (t) => [index("idx_cadence_runs_cadence").on(t.cadenceId)],
);

export type Cadence = typeof cadencesTable.$inferSelect;
export type CadenceRun = typeof cadenceRunsTable.$inferSelect;
export type InsertCadence = typeof cadencesTable.$inferInsert;
