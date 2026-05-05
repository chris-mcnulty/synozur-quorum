/**
 * Seeds all "famous" advisor presets into the demo tenant's roster so they
 * can be selected and seated on any board.
 *
 * Run: pnpm --filter @workspace/scripts run seed-famous-roster
 *
 * Idempotent: existing rows (matched by name) are skipped, not duplicated.
 */
import { db, tenantAdvisorsTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ADVISOR_PRESETS } from "../../artifacts/api-server/src/lib/presets.js";

const DEMO_EMAIL = "chris.mcnulty@synozur.com";

async function main() {
  // ── Resolve demo tenant ──────────────────────────────────────────────────
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .limit(1);

  if (!tenant) {
    console.error("No tenant found in the database. Run the server once to seed it.");
    process.exit(1);
  }

  console.log(`Seeding into tenant: ${tenant.name} (${tenant.id})`);

  // ── Load existing roster names to avoid duplicates ───────────────────────
  const existing = await db
    .select({ name: tenantAdvisorsTable.name })
    .from(tenantAdvisorsTable)
    .where(eq(tenantAdvisorsTable.tenantId, tenant.id));

  const existingNames = new Set(existing.map((r) => r.name));

  // ── Filter to famous presets only ─────────────────────────────────────────
  const famousPresets = ADVISOR_PRESETS.filter((p) => p.kind === "famous");

  const toInsert = famousPresets.filter((p) => !existingNames.has(p.name));
  const skipped = famousPresets.filter((p) => existingNames.has(p.name));

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} already-present advisor(s):`);
    skipped.forEach((p) => console.log(`  · ${p.name}`));
  }

  if (toInsert.length === 0) {
    console.log("All famous advisors are already in the roster. Nothing to insert.");
    return;
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const inserted = await db
    .insert(tenantAdvisorsTable)
    .values(
      toInsert.map((p) => ({
        tenantId: tenant.id,
        name: p.name,
        roleTitle: p.roleTitle,
        lensDescription: p.lensDescription ?? null,
        instructionsText: p.instructionsText,
      })),
    )
    .returning({ id: tenantAdvisorsTable.id, name: tenantAdvisorsTable.name });

  console.log(`\nInserted ${inserted.length} advisor(s):`);
  inserted.forEach((r) => console.log(`  ✓ ${r.name} (${r.id})`));
  console.log("\nDone. Open the Advisor Library → Roster tab to confirm.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
