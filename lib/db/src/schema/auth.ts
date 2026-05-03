import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  varchar,
} from "drizzle-orm/pg-core";

// Session storage
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users (supports Replit OIDC, local password, Entra SSO, and anonymous)
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  displayName: text("display_name"),
  passwordHash: varchar("password_hash"),
  authProvider: varchar("auth_provider", { length: 20 }).default("replit"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type UpsertUser = typeof usersTable.$inferInsert;
