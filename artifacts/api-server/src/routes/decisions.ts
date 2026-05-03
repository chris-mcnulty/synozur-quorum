import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  decisionsTable,
  decisionOutcomesTable,
  boardsTable,
  advisorySessionsTable,
} from "@workspace/db";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { apiOps } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";

const router: IRouter = Router();

type DecisionRow = typeof decisionsTable.$inferSelect;
type OutcomeRow = typeof decisionOutcomesTable.$inferSelect;

function serializeOutcome(o: OutcomeRow | null | undefined) {
  if (!o) return null;
  return {
    id: o.id,
    decisionId: o.decisionId,
    tag: o.tag,
    noteText: o.noteText,
    recordedBy: o.recordedBy,
    recordedAt: o.recordedAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function serializeDecision(
  d: DecisionRow,
  outcome: OutcomeRow | null | undefined,
  boardName?: string | null,
) {
  return {
    id: d.id,
    tenantId: d.tenantId,
    boardId: d.boardId,
    boardName: boardName ?? null,
    sessionId: d.sessionId,
    questionText: d.questionText,
    recommendationText: d.recommendationText,
    voteYes: d.voteYes,
    voteNo: d.voteNo,
    voteAbstain: d.voteAbstain,
    status: d.status,
    decidedAt: d.decidedAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    outcome: serializeOutcome(outcome),
  };
}

async function loadDecisionsWithOutcomes(rows: DecisionRow[]) {
  if (rows.length === 0) return [] as Array<ReturnType<typeof serializeDecision>>;
  const ids = rows.map((r) => r.id);
  const outcomes = await db
    .select()
    .from(decisionOutcomesTable)
    .where(sql`${decisionOutcomesTable.decisionId} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const outcomeMap = new Map(outcomes.map((o) => [o.decisionId, o]));

  const boardIds = Array.from(new Set(rows.map((r) => r.boardId)));
  const boards = boardIds.length
    ? await db
        .select({ id: boardsTable.id, name: boardsTable.name })
        .from(boardsTable)
        .where(sql`${boardsTable.id} IN (${sql.join(boardIds.map((i) => sql`${i}`), sql`, `)})`)
    : [];
  const boardMap = new Map(boards.map((b) => [b.id, b.name]));

  return rows.map((r) =>
    serializeDecision(r, outcomeMap.get(r.id) ?? null, boardMap.get(r.boardId) ?? null),
  );
}

// List decisions for a board
router.get("/boards/:boardId/decisions", async (req: Request, res: Response) => {
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, req.params.boardId as string))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
  if (!ctx) return;

  const rows = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.boardId, board.id))
    .orderBy(desc(decisionsTable.decidedAt));
  res.json(await loadDecisionsWithOutcomes(rows));
});

// List decisions for a tenant (with optional filters)
router.get("/tenants/:tenantId/decisions", async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  const status = typeof req.query.status === "string" ? req.query.status : null;
  const tag = typeof req.query.tag === "string" ? req.query.tag : null;

  const baseConds = [eq(decisionsTable.tenantId, tenantId)];
  if (status) baseConds.push(eq(decisionsTable.status, status));

  let rows = await db
    .select()
    .from(decisionsTable)
    .where(and(...baseConds))
    .orderBy(desc(decisionsTable.decidedAt));

  let serialized = await loadDecisionsWithOutcomes(rows);
  if (tag) {
    serialized = serialized.filter((s) => s.outcome?.tag === tag);
  }
  res.json(serialized);
});

// Decisions due for review (>= 30 days old, no outcome, status=PENDING)
router.get(
  "/tenants/:tenantId/decisions/due-for-review",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ d: decisionsTable })
      .from(decisionsTable)
      .leftJoin(
        decisionOutcomesTable,
        eq(decisionOutcomesTable.decisionId, decisionsTable.id),
      )
      .where(
        and(
          eq(decisionsTable.tenantId, tenantId),
          eq(decisionsTable.status, "PENDING"),
          lt(decisionsTable.decidedAt, cutoff),
          isNull(decisionOutcomesTable.id),
        ),
      )
      .orderBy(decisionsTable.decidedAt);

    res.json(await loadDecisionsWithOutcomes(rows.map((r) => r.d)));
  },
);

// Get a single decision
router.get("/decisions/:decisionId", async (req: Request, res: Response) => {
  const [decision] = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.id, req.params.decisionId as string))
    .limit(1);
  if (!decision) {
    res.status(404).json({ error: "Decision not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, decision.tenantId, "VIEWER");
  if (!ctx) return;

  const [outcome] = await db
    .select()
    .from(decisionOutcomesTable)
    .where(eq(decisionOutcomesTable.decisionId, decision.id))
    .limit(1);
  const [board] = await db
    .select({ name: boardsTable.name })
    .from(boardsTable)
    .where(eq(boardsTable.id, decision.boardId))
    .limit(1);

  res.json(serializeDecision(decision, outcome ?? null, board?.name ?? null));
});

// Update decision status
router.patch("/decisions/:decisionId", async (req: Request, res: Response) => {
  const [decision] = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.id, req.params.decisionId as string))
    .limit(1);
  if (!decision) {
    res.status(404).json({ error: "Decision not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, decision.tenantId, "EDITOR");
  if (!ctx) return;

  const parsed = apiOps.UpdateDecisionStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [updated] = await db
    .update(decisionsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(decisionsTable.id, decision.id))
    .returning();

  const [outcome] = await db
    .select()
    .from(decisionOutcomesTable)
    .where(eq(decisionOutcomesTable.decisionId, decision.id))
    .limit(1);
  const [board] = await db
    .select({ name: boardsTable.name })
    .from(boardsTable)
    .where(eq(boardsTable.id, decision.boardId))
    .limit(1);

  res.json(serializeDecision(updated, outcome ?? null, board?.name ?? null));
});

// Record (upsert) an outcome
router.post(
  "/decisions/:decisionId/outcome",
  async (req: Request, res: Response) => {
    const [decision] = await db
      .select()
      .from(decisionsTable)
      .where(eq(decisionsTable.id, req.params.decisionId as string))
      .limit(1);
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, decision.tenantId, "EDITOR");
    if (!ctx) return;

    const parsed = apiOps.RecordDecisionOutcomeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [existing] = await db
      .select()
      .from(decisionOutcomesTable)
      .where(eq(decisionOutcomesTable.decisionId, decision.id))
      .limit(1);

    let outcomeRow: OutcomeRow;
    if (existing) {
      const [up] = await db
        .update(decisionOutcomesTable)
        .set({
          tag: parsed.data.tag,
          noteText: parsed.data.noteText ?? null,
          recordedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(decisionOutcomesTable.id, existing.id))
        .returning();
      outcomeRow = up;
    } else {
      const [ins] = await db
        .insert(decisionOutcomesTable)
        .values({
          decisionId: decision.id,
          tag: parsed.data.tag,
          noteText: parsed.data.noteText ?? null,
          recordedBy: ctx.userId,
        })
        .returning();
      outcomeRow = ins;
    }

    const nextStatus = parsed.data.status ?? decision.status;
    const [updated] = await db
      .update(decisionsTable)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(decisionsTable.id, decision.id))
      .returning();

    const [board] = await db
      .select({ name: boardsTable.name })
      .from(boardsTable)
      .where(eq(boardsTable.id, decision.boardId))
      .limit(1);

    res.json(serializeDecision(updated, outcomeRow, board?.name ?? null));
  },
);

export default router;
