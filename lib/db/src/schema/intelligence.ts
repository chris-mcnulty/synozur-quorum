import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { advisorySessionsTable } from "./sessions";

export const sessionTopicsTable = pgTable(
  "session_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    ordering: integer("ordering").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_session_topics_session").on(t.sessionId),
    uniqueIndex("uq_session_topics").on(t.sessionId, t.topic),
  ],
);

export type SessionTopic = typeof sessionTopicsTable.$inferSelect;
export type InsertSessionTopic = typeof sessionTopicsTable.$inferInsert;
