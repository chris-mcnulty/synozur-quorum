/**
 * Seeds nine app-wide (tenantId=null) grounding documents — one per Synozur
 * preset member. These are the canonical reference texts each persona should
 * receive when seated onto any tenant's board via /seat-preset or
 * /seat-template.
 *
 * Run: pnpm --filter @workspace/scripts run seed-preset-grounding
 *
 * Idempotent: re-running upserts the row keyed by presetSlug.
 *
 * Replacing the placeholder text:
 *   The `text` field below is a placeholder marker. Replace with the canonical
 *   source material (e.g., Buffett's collected shareholder letters, Krugman's
 *   columns) before relying on the grounding for production use. The seed
 *   stores the text directly in `extracted_text`; no object storage is used
 *   for global preset grounding (storagePath is set to a synthetic marker).
 */
import { db } from "@workspace/db";
import { groundingDocumentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

interface PresetGrounding {
  presetSlug: string;
  filename: string;
  text: string;
}

const PRESET_GROUNDING: PresetGrounding[] = [
  {
    presetSlug: "warren-buffett",
    filename: "buffett-reference.md",
    text: "PLACEHOLDER — Warren Buffett canonical reference material (e.g., Berkshire Hathaway annual letters 1965–present, selected interviews, Owner's Manual). Replace via the seed-preset-grounding script before production use.",
  },
  {
    presetSlug: "paul-krugman",
    filename: "krugman-reference.md",
    text: "PLACEHOLDER — Paul Krugman canonical reference material (e.g., selected NYT columns, The Return of Depression Economics, trade-theory essays). Replace before production use.",
  },
  {
    presetSlug: "mark-cuban",
    filename: "cuban-reference.md",
    text: "PLACEHOLDER — Mark Cuban canonical reference material (e.g., How to Win at the Sport of Business, blog posts, Shark Tank decision rationale). Replace before production use.",
  },
  {
    presetSlug: "bill-belichick",
    filename: "belichick-reference.md",
    text: "PLACEHOLDER — Bill Belichick canonical reference material (e.g., The Art of Winning, press conference transcripts, system/preparation philosophy). Replace before production use.",
  },
  {
    presetSlug: "barack-obama",
    filename: "obama-reference.md",
    text: "PLACEHOLDER — Barack Obama canonical reference material (e.g., A Promised Land, selected speeches, decision-making memos). Replace before production use.",
  },
  {
    presetSlug: "satya-nadella",
    filename: "nadella-reference.md",
    text: "PLACEHOLDER — Satya Nadella canonical reference material (e.g., Hit Refresh, annual shareholder letters, public talks on platform/culture). Replace before production use.",
  },
  {
    presetSlug: "steven-spielberg",
    filename: "spielberg-reference.md",
    text: "PLACEHOLDER — Steven Spielberg canonical reference material (e.g., AFI/DGA interviews, on-record statements about narrative and audience). Replace before production use.",
  },
  {
    presetSlug: "sheryl-sandberg",
    filename: "sandberg-reference.md",
    text: "PLACEHOLDER — Sheryl Sandberg canonical reference material (e.g., Lean In, Option B, Meta operating reviews and talks). Replace before production use.",
  },
  {
    presetSlug: "john-hillen",
    filename: "hillen-reference.md",
    text: "PLACEHOLDER — Dr. John Hillen canonical reference material (e.g., The Strategy Dialogues, lectures on strategy as a discipline). Replace before production use.",
  },
];

async function main() {
  for (const g of PRESET_GROUNDING) {
    const [existing] = await db
      .select()
      .from(groundingDocumentsTable)
      .where(eq(groundingDocumentsTable.presetSlug, g.presetSlug))
      .limit(1);

    if (existing) {
      await db
        .update(groundingDocumentsTable)
        .set({
          tenantId: null,
          uploadedBy: null,
          filename: g.filename,
          contentType: "text/markdown",
          storagePath: `preset://${g.presetSlug}`,
          extractedText: g.text,
          characterCount: g.text.length,
          truncated: false,
        })
        .where(eq(groundingDocumentsTable.id, existing.id));
      console.log(`  Updated: ${g.presetSlug} (${existing.id})`);
    } else {
      const [inserted] = await db
        .insert(groundingDocumentsTable)
        .values({
          tenantId: null,
          presetSlug: g.presetSlug,
          filename: g.filename,
          contentType: "text/markdown",
          storagePath: `preset://${g.presetSlug}`,
          extractedText: g.text,
          characterCount: g.text.length,
          truncated: false,
        })
        .returning();
      console.log(`  Inserted: ${g.presetSlug} (${inserted!.id})`);
    }
  }

  console.log(`\nDone. ${PRESET_GROUNDING.length} preset grounding documents seeded.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
