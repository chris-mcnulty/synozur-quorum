import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, advisorySessionsTable, sessionContributionsTable, sessionSummariesTable, boardsTable, boardMembersTable, } from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { apiOps, CreateSessionBody } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  runSession,
  subscribeToSession,
  type ProgressEvent,
} from "../lib/sessionRunner";
import {
  callClaude,
  MASTER_MODEL_DEFAULT,
} from "../lib/anthropic";

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
    parentSessionId: s.parentSessionId ?? null,
    branchNote: s.branchNote ?? null,
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
        allHands: Boolean(parsed.data.allHands),
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
      includeResolvedDecisions: Boolean(parsed.data.includeResolvedDecisions),
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

// ───── Branch a completed session ─────
router.post("/sessions/:sessionId/branch", async (req: Request, res: Response) => {
  const [parent] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, req.params.sessionId as string))
    .limit(1);
  if (!parent) {
    res.status(404).json({ error: "Parent session not found" });
    return;
  }
  if (parent.status !== "complete") {
    res
      .status(400)
      .json({ error: "Only completed sessions can be branched." });
    return;
  }
  const ctx = await requireTenantRole(req, res, parent.tenantId, "EDITOR");
  if (!ctx) return;

  const parsed = apiOps.BranchSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const memberCount = (
    await db
      .select({ id: boardMembersTable.id })
      .from(boardMembersTable)
      .where(eq(boardMembersTable.boardId, parent.boardId))
  ).length;
  if (memberCount === 0) {
    res.status(400).json({ error: "Board has no members." });
    return;
  }

  const mode = (parsed.data.mode ?? parent.mode) as "ADVISORY" | "BOARD" | "REVIEW";

  const [parentSummary] = await db
    .select()
    .from(sessionSummariesTable)
    .where(eq(sessionSummariesTable.sessionId, parent.id))
    .limit(1);

  const [child] = await db
    .insert(advisorySessionsTable)
    .values({
      tenantId: parent.tenantId,
      boardId: parent.boardId,
      mode,
      questionText: parsed.data.questionText,
      status: "running",
      createdBy: ctx.userId,
      parentSessionId: parent.id,
      branchNote: parsed.data.branchNote,
      allHands: parent.allHands,
    })
    .returning();

  void runSession({
    sessionId: child.id,
    tenantId: parent.tenantId,
    boardId: parent.boardId,
    mode,
    question: parsed.data.questionText,
    allHands: parent.allHands,
    branchContext: {
      parentQuestion: parent.questionText,
      parentFinalSummary: parentSummary?.finalSummary ?? null,
      parentConvergenceNote: parentSummary?.convergenceNote ?? null,
      branchNote: parsed.data.branchNote,
    },
  }).catch((err) => {
    req.log.error({ err, sessionId: child.id }, "Branch runner crashed");
  });

  res.status(201).json(serializeSession(child));
});

// ───── Session lineage tree ─────
router.get("/sessions/:sessionId/lineage", async (req: Request, res: Response) => {
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, req.params.sessionId as string))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
  if (!ctx) return;

  const parent = session.parentSessionId
    ? (
        await db
          .select()
          .from(advisorySessionsTable)
          .where(eq(advisorySessionsTable.id, session.parentSessionId))
          .limit(1)
      )[0]
    : null;

  const siblings = session.parentSessionId
    ? await db
        .select()
        .from(advisorySessionsTable)
        .where(
          and(
            eq(advisorySessionsTable.parentSessionId, session.parentSessionId),
            ne(advisorySessionsTable.id, session.id),
          ),
        )
        .orderBy(desc(advisorySessionsTable.startedAt))
    : [];

  const children = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.parentSessionId, session.id))
    .orderBy(desc(advisorySessionsTable.startedAt));

  res.json({
    sessionId: session.id,
    parent: parent ? serializeSession(parent) : null,
    siblings: siblings.map(serializeSession),
    children: children.map(serializeSession),
  });
});

// ───── Compare 2-4 sessions ─────
router.post("/sessions/compare", async (req: Request, res: Response) => {
  const parsed = apiOps.CompareSessionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const ids = Array.from(new Set(parsed.data.sessionIds));
  if (ids.length < 2 || ids.length > 4) {
    res.status(400).json({ error: "Provide 2-4 distinct session ids" });
    return;
  }

  const sessions = await db
    .select()
    .from(advisorySessionsTable)
    .where(inArray(advisorySessionsTable.id, ids));
  if (sessions.length !== ids.length) {
    res.status(404).json({ error: "One or more sessions not found" });
    return;
  }

  const tenantIds = new Set(sessions.map((s) => s.tenantId));
  if (tenantIds.size !== 1) {
    res.status(400).json({ error: "Sessions span multiple tenants" });
    return;
  }
  const tenantId = sessions[0].tenantId;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  const orderedSessions = ids.map((id) => sessions.find((s) => s.id === id)!);

  const boards = await db
    .select()
    .from(boardsTable)
    .where(inArray(boardsTable.id, orderedSessions.map((s) => s.boardId)));
  const boardById = new Map(boards.map((b) => [b.id, b]));

  const allContribs = await db
    .select()
    .from(sessionContributionsTable)
    .where(inArray(sessionContributionsTable.sessionId, ids))
    .orderBy(sessionContributionsTable.createdAt);

  const summaries = await db
    .select()
    .from(sessionSummariesTable)
    .where(inArray(sessionSummariesTable.sessionId, ids));
  const summaryBySession = new Map(summaries.map((s) => [s.sessionId, s]));

  const entries = orderedSessions.map((s) => {
    const board = boardById.get(s.boardId);
    const contribs = allContribs.filter((c) => c.sessionId === s.id);
    const sum = summaryBySession.get(s.id) ?? null;
    return {
      session: serializeSession(s),
      boardName: board?.name ?? "—",
      establishedFactsText: s.establishedFactsText ?? null,
      contributions: contribs.map(serializeContribution),
      summary: sum
        ? {
            id: sum.id,
            sessionId: sum.sessionId,
            chairsFraming: sum.chairsFraming,
            convergenceNote: sum.convergenceNote,
            openQuestionsText: sum.openQuestionsText,
            finalSummary: sum.finalSummary,
            flagsRaisedText: sum.flagsRaisedText,
            totalCostCents: sum.totalCostCents,
            createdAt: sum.createdAt.toISOString(),
          }
        : null,
    };
  });

  // Build aligned-by-advisor (memberKey = roleTitle|name) matrix
  const memberKeyOrder: string[] = [];
  const memberMeta = new Map<string, { memberName: string; memberRoleTitle: string }>();
  const matrix = new Map<string, Map<string, typeof allContribs[number]>>();
  for (const c of allContribs) {
    const key = `${(c.memberRoleTitle ?? "").toLowerCase()}|${(c.memberName ?? "").toLowerCase()}`;
    if (!memberMeta.has(key)) {
      memberMeta.set(key, {
        memberName: c.memberName ?? "Advisor",
        memberRoleTitle: c.memberRoleTitle ?? "",
      });
      memberKeyOrder.push(key);
    }
    if (!matrix.has(key)) matrix.set(key, new Map());
    matrix.get(key)!.set(c.sessionId, c);
  }
  const memberAlignments = memberKeyOrder.map((key) => {
    const meta = memberMeta.get(key)!;
    return {
      memberKey: key,
      memberName: meta.memberName,
      memberRoleTitle: meta.memberRoleTitle,
      perSession: ids.map((sid) => {
        const c = matrix.get(key)?.get(sid);
        return c ? serializeContribution(c) : null;
      }),
    };
  });

  // Master delta synthesis
  const completedEntries = entries.filter((e) => e.session.status === "complete");
  let deltaNote = "";
  if (completedEntries.length >= 2) {
    const masterPrompt = [
      "You are the Chair comparing parallel council sessions.",
      "For each session below, you have the question, established facts, and per-advisor contributions.",
      "Produce a crisp 'what changed in the council's reasoning' note that highlights:",
      "- Where votes flipped or rationales shifted",
      "- Which advisors changed their stance",
      "- Net delta in the final recommendation",
      "Keep it under 300 words. Use markdown headers per session label (A, B, C, D).",
    ].join("\n");
    const userBlocks = entries.map((e, i) => {
      const label = String.fromCharCode(65 + i);
      const lines = [
        `### Session ${label} — ${e.session.id.slice(0, 8)}`,
        `Question: ${e.session.questionText}`,
        e.session.branchNote ? `Branch note: ${e.session.branchNote}` : "",
        `Status: ${e.session.status}`,
        e.summary?.finalSummary ? `Final summary: ${e.summary.finalSummary}` : "",
        e.summary?.convergenceNote ? `Convergence: ${e.summary.convergenceNote}` : "",
        "Contributions:",
        ...e.contributions.map(
          (c) =>
            `- ${c.memberName} (${c.memberRoleTitle}) [vote=${c.vote ?? "n/a"}]: ${
              (c.contributionText ?? "").slice(0, 600)
            }`,
        ),
      ].filter(Boolean);
      return lines.join("\n");
    });
    try {
      const r = await callClaude({
        model: MASTER_MODEL_DEFAULT,
        systemPrompt: masterPrompt,
        userMessage: userBlocks.join("\n\n"),
        maxTokens: 1500,
        temperature: 0.4,
        logger: req.log,
      });
      if (r.status === "complete") {
        deltaNote = r.text;
      } else {
        deltaNote = `_Master delta synthesis unavailable (${r.status}: ${r.errorDetail ?? ""})._`;
      }
    } catch (err) {
      req.log.error({ err }, "Compare delta failed");
      deltaNote = "_Master delta synthesis failed._";
    }
  } else {
    deltaNote =
      "_At least two completed sessions are required for a delta synthesis. Showing what is available._";
  }

  res.json({ entries, deltaNote, memberAlignments });
});

export default router;
