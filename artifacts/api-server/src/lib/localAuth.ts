/**
 * Local password authentication helpers and startup user seeding.
 */
import crypto from "crypto";
import { db, usersTable, tenantMembersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Password hashing with Node's built-in scrypt
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return `${salt}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_r,
      p: SCRYPT_p,
    });
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// User ID helpers
// ---------------------------------------------------------------------------

export function localUserId(email: string): string {
  return `local:${email.toLowerCase().trim()}`;
}

export function anonUserId(): string {
  return `anon:${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Seed guaranteed local users on startup
// ---------------------------------------------------------------------------

interface LocalUserSeed {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

const SEEDED_USERS: LocalUserSeed[] = [
  {
    email: "chris.mcnulty@synozur.com",
    password: "East2west!",
    firstName: "Chris",
    lastName: "McNulty",
    role: "OWNER",
  },
];

export async function ensureLocalUsersSeeded(): Promise<void> {
  // Find the first tenant (Demo Co)
  const [tenant] = await db.select().from(tenantsTable).limit(1);
  if (!tenant) {
    logger.warn("No tenant found — skipping local user seed");
    return;
  }

  for (const seed of SEEDED_USERS) {
    const id = localUserId(seed.email);

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (existing) {
      // Always refresh the password hash in case the desired password changed
      await db
        .update(usersTable)
        .set({ passwordHash: hashPassword(seed.password), updatedAt: new Date() })
        .where(eq(usersTable.id, id));
    } else {
      await db.insert(usersTable).values({
        id,
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        passwordHash: hashPassword(seed.password),
        authProvider: "local",
      });
    }

    // Ensure tenant membership
    await db
      .insert(tenantMembersTable)
      .values({ tenantId: tenant.id, userId: id, role: seed.role })
      .onConflictDoUpdate({
        target: [tenantMembersTable.tenantId, tenantMembersTable.userId],
        set: { role: seed.role },
      });

    logger.info({ email: seed.email, tenantId: tenant.id }, "Local user seeded");
  }
}
