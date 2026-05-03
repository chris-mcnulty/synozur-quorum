import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, advisorySessionsTable, sessionContributionsTable, sessionSummariesTable, boardsTable, boardMembersTable, } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { apiOps, CreateSessionBody } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  runSession,
  subscribeToSession,
  type ProgressEvent,
} from "../lib/sessionRunner";

const router: IRouter = Router();

function serializeSession(s: typeof advisorySessionsTable.$inferSelect) {
  return {
    id: s.id,
    boardId: s.boardId,
    mode: s.mode,
    questionText: s.questionText,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    totalCostCents: s.totalCostCents ?? null,
  };
}

function serializeContribution(
  c: typeof sessionContributionsTable.$inferSelect,
) {
  return {
    id: c.id,
    sessionId: c.sessionId,
    boardMemberId: c.boardMemberId,
    memberName: c.memberName,
    memberRoleTitle: c.memberRoleTitle,
    contributionText: c.contributionText,
    vote: c.vote,
    voteRationale: c.voteRationale,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    latencyMs: c.latencyMs,
    status: c.status,
    errorDetail: c.errorDetail,
    createdAt: c.createdAt.toISOString(),
  };
}

// List sessions for a board
router.get("/boards/:boardId/sessions", async (req: Request, res: Response) => {
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, (req.params.boardId as string)))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
  if (!ctx) return;

  const rows = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.boardId, board.id))
    .orderBy(desc(advisorySessionsTable.startedAt));

  res.json(rows.map(serializeSession));
});

// Create session — kicks off async run
router.post(
  "/boards/:boardId/sessions",
  async (req: Request, res: Response) => {
    const [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, (req.params.boardId as string)))
      .limit(1);
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, board.tenantId, "EDITOR");
    if (!ctx) return;

    const parsed = apiOps.CreateSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const memberCount = (
      await db
        .select({ id: boardMembersTable.id })
        .from(boardMembersTable)
        .where(eq(boardMembersTable.boardId, board.id))
    ).length;
    if (memberCount === 0) {
      res
        .status(400)
        .json({ error: "Board has no members. Add members before running a session." });
      return;
    }

    const [session] = await db
      .insert(advisorySessionsTable)
      .values({
        tenantId: board.tenantId,
        boardId: board.id,
        mode: parsed.data.mode,
        questionText: parsed.data.questionText,
        status: "running",
        createdBy: ctx.userId,
      })
      .returning();

    // Fire and forget
    void runSession({
      sessionId: session.id,
      tenantId: board.tenantId,
      boardId: board.id,
      mode: parsed.data.mode,
      question: parsed.data.questionText,
      allHands: Boolean(parsed.data.allHands),
    }).catch((err) => {
      req.log.error({ err, sessionId: session.id }, "Session runner crashed");
    });

    res.status(201).json(serializeSession(session));
  },
);

// SSE stream for a session — uses session cookie auth (EventSource doesn't send custom headers)
router.get("/sessions/:sessionId/stream", async (req: Request, res: Response) => {
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, (req.params.sessionId as string)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
  if (!ctx) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (e: ProgressEvent) => {
    // Unify SSE contract: emit all phase updates as `progress` with phase in payload,
    // terminal `complete` as `done`, and pass `error` through.
    if (e.type === "complete") {
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify(e.payload ?? {})}\n\n`);
      return;
    }
    if (e.type === "error") {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify(e.payload ?? {})}\n\n`);
      return;
    }
    const payload = { phase: e.type, ...(typeof e.payload === "object" && e.payload !== null ? e.payload : {}) };
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // If already complete or failed, replay terminal state and end
  if (session.status !== "running") {
    send({
      type: "complete",
      sessionId: session.id,
      payload: { alreadyComplete: true, status: session.status },
    });
    res.end();
    return;
  }

  const unsubscribe = subscribeToSession(session.id, send);
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

// Get session detail
router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, (req.params.sessionId as string)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
  if (!ctx) return;

  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, session.boardId))
    .limit(1);

  const contribs = await db
    .select()
    .from(sessionContributionsTable)
    .where(eq(sessionContributionsTable.sessionId, session.id))
    .orderBy(sessionContributionsTable.createdAt);

  const [summary] = await db
    .select()
    .from(sessionSummariesTable)
    .where(eq(sessionSummariesTable.sessionId, session.id))
    .limit(1);

  res.json({
    session: serializeSession(session),
    board: board
      ? {
          id: board.id,
          tenantId: board.tenantId,
          name: board.name,
          description: board.description,
          topicArea: board.topicArea,
          masterInstructionsText: board.masterInstructionsText,
          size: board.size,
          defaultMemberModel: board.defaultMemberModel,
          defaultMasterModel: board.defaultMasterModel,
          temperature: Number(board.temperature),
          createdBy: board.createdBy,
          createdAt: board.createdAt.toISOString(),
          updatedAt: board.updatedAt.toISOString(),
        }
      : null,
    establishedFactsText: session.establishedFactsText,
    contributions: contribs.map(serializeContribution),
    summary: summary
      ? {
          id: summary.id,
          sessionId: summary.sessionId,
          chairsFraming: summary.chairsFraming,
          convergenceNote: summary.convergenceNote,
          openQuestionsText: summary.openQuestionsText,
          finalSummary: summary.finalSummary,
          flagsRaisedText: summary.flagsRaisedText,
          totalCostCents: summary.totalCostCents,
          createdAt: summary.createdAt.toISOString(),
        }
      : null,
  });
});

export default router;
