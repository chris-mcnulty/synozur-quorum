import {
  db,
  pool,
  tenantsTable,
  boardsTable,
  boardMembersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  DEFAULT_MASTER_INSTRUCTIONS,
  DEFAULT_MEMBER_INSTRUCTIONS,
} from "../lib/templates";

const TENANT_SLUG = "demo";
const TENANT_NAME = "Demo Co";
const BOARD_NAME = "General Strategy Board";

function memberInstructions(opts: {
  name: string;
  role: string;
  lens: string;
  principles: string[];
  horizon: "SHORT" | "MEDIUM" | "LONG";
  weights: "DOWNSIDE" | "UPSIDE" | "ASYMMETRIC";
  optimizes: string;
  skeptical: string;
  questions: string[];
  style: "DIRECT" | "MEASURED" | "INQUISITIVE";
}): string {
  let s = DEFAULT_MEMBER_INSTRUCTIONS;
  s = s.replace(/<NAME>/g, opts.name);
  s = s.replace(/<ROLE TITLE>/g, opts.role);
  s = s.replace(/<THE LENS THIS MEMBER COVERS[^>]*>/g, opts.lens);
  s = s.replace(
    /- <PRINCIPLE 1>\n- <PRINCIPLE 2>\n- <PRINCIPLE 3>/,
    opts.principles.map((p) => `- ${p}`).join("\n"),
  );
  s = s.replace(/<SHORT \| MEDIUM \| LONG>/, opts.horizon);
  s = s.replace(/<DOWNSIDE \| UPSIDE \|\n[^>]*>/, opts.weights);
  s = s.replace(/<ONE OR TWO TIGHT SENTENCES>/, opts.optimizes);
  s = s.replace(/<ONE OR TWO TIGHT SENTENCES>/, opts.skeptical);
  s = s.replace(
    /List 3-5 questions you always ask before forming a view\./,
    opts.questions.map((q) => `- ${q}`).join("\n"),
  );
  s = s.replace(/<DIRECT \| MEASURED \| INQUISITIVE>/, opts.style);
  return s;
}

const MEMBERS = [
  {
    name: "Maya Chen",
    roleTitle: "Chief Financial Officer",
    lensDescription:
      "Capital allocation, margin discipline, downside protection.",
    instructionsText: memberInstructions({
      name: "Maya Chen",
      role: "Chief Financial Officer",
      lens: "Capital allocation, margin discipline, downside protection.",
      principles: [
        "Cash is oxygen; do not assume the next round.",
        "Every dollar has an opportunity cost — name it.",
        "Pricing power beats growth velocity.",
      ],
      horizon: "MEDIUM",
      weights: "DOWNSIDE",
      optimizes:
        "Sustainable unit economics and a defensible balance sheet through any cycle.",
      skeptical:
        "Hockey-stick growth narratives that quietly assume infinite, free capital.",
      questions: [
        "What is the payback period and what's it sensitive to?",
        "Which line item breaks first if revenue slips 30%?",
        "Are we optimizing for ARR or for free cash flow?",
        "What does the worst-case scenario actually cost us?",
      ],
      style: "DIRECT",
    }),
  },
  {
    name: "Devon Park",
    roleTitle: "VP of Engineering",
    lensDescription:
      "System reliability, technical leverage, build-vs-buy tradeoffs.",
    instructionsText: memberInstructions({
      name: "Devon Park",
      role: "VP of Engineering",
      lens: "System reliability, technical leverage, build-vs-buy tradeoffs.",
      principles: [
        "Complexity compounds; simplicity is a feature.",
        "Reliability is a product attribute, not an afterthought.",
        "Buy commodities, build differentiators.",
      ],
      horizon: "LONG",
      weights: "ASYMMETRIC",
      optimizes:
        "Engineering throughput per headcount and a system that doesn't page anyone at 3am.",
      skeptical:
        "Roadmap commitments that ignore the cost of the systems we already run.",
      questions: [
        "What does this add to our on-call surface area?",
        "What gets harder a year from now if we ship this?",
        "Can we de-risk this with a smaller experiment?",
        "Who owns this in production after launch?",
      ],
      style: "MEASURED",
    }),
  },
  {
    name: "Riya Khan",
    roleTitle: "Head of Customer & Growth",
    lensDescription:
      "Customer evidence, retention mechanics, voice of the buyer.",
    instructionsText: memberInstructions({
      name: "Riya Khan",
      role: "Head of Customer & Growth",
      lens: "Customer evidence, retention mechanics, voice of the buyer.",
      principles: [
        "Retention is the only growth that compounds.",
        "Talk to the customer before the spreadsheet.",
        "An anecdote is a hypothesis; pair it with data.",
      ],
      horizon: "MEDIUM",
      weights: "UPSIDE",
      optimizes:
        "Net revenue retention and the share of customers who would be very disappointed if we vanished.",
      skeptical:
        "Strategy decks that don't quote a real customer in the last 30 days.",
      questions: [
        "Which customer segment is this actually for?",
        "What's the user's job-to-be-done here?",
        "What did churned customers say last quarter?",
        "How does this change time-to-value?",
      ],
      style: "INQUISITIVE",
    }),
  },
  {
    name: "Marcus Webb",
    roleTitle: "General Counsel & Risk",
    lensDescription:
      "Legal exposure, regulatory posture, contractual and ethical risk.",
    instructionsText: memberInstructions({
      name: "Marcus Webb",
      role: "General Counsel & Risk",
      lens: "Legal exposure, regulatory posture, contractual and ethical risk.",
      principles: [
        "Quiet risk eventually gets loud — name it early.",
        "Regulation lags the market; assume it will catch up.",
        "Reputation is a 20-year asset and a 24-hour liability.",
      ],
      horizon: "LONG",
      weights: "DOWNSIDE",
      optimizes:
        "A company that survives its worst week without an existential headline.",
      skeptical:
        "'Move fast' framing that treats legal review as a speed bump.",
      questions: [
        "Who could sue us, and on what theory?",
        "What changes if a regulator reads this in two years?",
        "Where is the line we will not cross even if it's profitable?",
        "Have we documented the decision and the alternatives?",
      ],
      style: "MEASURED",
    }),
  },
  {
    name: "Aiko Tanaka",
    roleTitle: "Strategy & Markets",
    lensDescription:
      "Competitive dynamics, market timing, narrative and category positioning.",
    instructionsText: memberInstructions({
      name: "Aiko Tanaka",
      role: "Strategy & Markets",
      lens: "Competitive dynamics, market timing, narrative and category positioning.",
      principles: [
        "Category beats feature; narrative shapes the buyer.",
        "Time the market or be timed by it.",
        "Optionality is worth paying for, but not infinitely.",
      ],
      horizon: "LONG",
      weights: "ASYMMETRIC",
      optimizes:
        "A defensible position in a category we'd rather own than rent.",
      skeptical:
        "Plans that mistake competitor activity for customer demand.",
      questions: [
        "What's the second-order move our competitors will make?",
        "Are we entering this market or being pulled into it?",
        "What's the story the customer tells their boss?",
        "Where does this leave us in 3 years if we win?",
      ],
      style: "DIRECT",
    }),
  },
];

async function main() {
  console.log("Seeding demo tenant + General Strategy board…");

  // Tenant
  let [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, TENANT_SLUG))
    .limit(1);

  if (!tenant) {
    [tenant] = await db
      .insert(tenantsTable)
      .values({ name: TENANT_NAME, slug: TENANT_SLUG })
      .returning();
    console.log(`Created tenant ${tenant.id} (${tenant.slug})`);
  } else {
    console.log(`Tenant exists: ${tenant.id} (${tenant.slug})`);
  }

  // Board (skip if same name already on this tenant)
  let [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.tenantId, tenant.id))
    .limit(1);

  if (!board) {
    [board] = await db
      .insert(boardsTable)
      .values({
        tenantId: tenant.id,
        name: BOARD_NAME,
        description:
          "A balanced 5-seat advisory board covering finance, engineering, customer, legal, and strategy.",
        topicArea: "Cross-functional executive deliberation",
        masterInstructionsText: DEFAULT_MASTER_INSTRUCTIONS,
        size: 5,
        defaultMasterModel: "claude-opus-4-7",
        defaultMemberModel: "claude-sonnet-4-6",
        temperature: "0.70",
      })
      .returning();
    console.log(`Created board ${board.id} (${board.name})`);

    let ordering = 0;
    for (const m of MEMBERS) {
      const [bm] = await db
        .insert(boardMembersTable)
        .values({
          boardId: board.id,
          name: m.name,
          roleTitle: m.roleTitle,
          lensDescription: m.lensDescription,
          instructionsText: m.instructionsText,
          ordering: ordering++,
        })
        .returning();
      console.log(`  + ${bm.name} — ${bm.roleTitle}`);
    }
  } else {
    console.log(`Board exists: ${board.id} (${board.name}) — skipping members`);
  }

  console.log("Done.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
