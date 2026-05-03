import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { advisorySessionsTable } from "./sessions";

export const tenantAudioSettingsTable = pgTable("tenant_audio_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  feedTitle: text("feed_title"),
  feedAuthor: text("feed_author"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessionAudioTable = pgTable(
  "session_audio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .unique()
      .references(() => advisorySessionsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    boardId: uuid("board_id").notNull(),
    storagePath: text("storage_path").notNull(),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    bytes: integer("bytes").notNull().default(0),
    voicesUsed: jsonb("voices_used").$type<string[]>().notNull().default([]),
    sections: jsonb("sections")
      .$type<Array<{ label: string; key: string; offsetMs: number }>>()
      .notNull()
      .default([]),
    costCents: integer("cost_cents").notNull().default(0),
    transcriptText: text("transcript_text"),
    status: text("status").notNull().default("ready"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_session_audio_tenant").on(t.tenantId),
    index("idx_session_audio_board").on(t.boardId),
  ],
);

export type TenantAudioSettings = typeof tenantAudioSettingsTable.$inferSelect;
export type SessionAudio = typeof sessionAudioTable.$inferSelect;
