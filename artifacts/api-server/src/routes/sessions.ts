import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import {
  db, advisorySessionsTable, sessionContributionsTable, sessionSummariesTable, boardsTable, boardMembersTable, sessionShareLinksTable, } from "@workspace/db";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
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
    pivotContributionId: s.pivotContributionId ?? null,
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

  // For terminal sessions, signal alreadyComplete so the client stops its
  // session-progress UI, but keep the channel open so collaboration events
  // (comments, reactions, presence, follow-ups) can be broadcast live.
  if (session.status !== "running") {
    res.write(`event: progress\n`);
    res.write(
      `data: ${JSON.stringify({ phase: "already_complete", status: session.status })}\n\n`,
    );
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

  // ───── Rewind path: branch from a specific advisor contribution ─────
  const fromContributionId = parsed.data.fromContributionId ?? null;
  if (fromContributionId) {
    const [pivot] = await db
      .select()
      .from(sessionContributionsTable)
      .where(eq(sessionContributionsTable.id, fromContributionId))
      .limit(1);
    if (!pivot || pivot.sessionId !== parent.id) {
      res
        .status(400)
        .json({ error: "fromContributionId does not belong to the parent session." });
      return;
    }
    if (!pivot.boardMemberId) {
      res
        .status(400)
        .json({ error: "Cannot rewind from a contribution with no associated board member." });
      return;
    }

    // Use the parent's authoritative routed advisor sequence — persisted at
    // framing time on the parent — as the source of truth. We do NOT derive
    // it from board roster ordering, so the rewind faithfully re-runs the
    // exact members the chair routed, in the exact order, even if that
    // differs from the current roster.
    const parentRoutedSeq = parent.routedMemberIds ?? null;
    if (!parentRoutedSeq || parentRoutedSeq.length === 0) {
      res.status(400).json({
        error:
          "Parent session has no recorded routed sequence; cannot rewind. (Older sessions created before routed-sequence persistence are not eligible.)",
      });
      return;
    }

    const pivotMemberPosition = parentRoutedSeq.indexOf(pivot.boardMemberId);
    if (pivotMemberPosition < 0) {
      res.status(400).json({
        error:
          "Pivot contribution's advisor is not part of the parent's routed sequence.",
      });
      return;
    }

    // The contributions to inherit verbatim are the parent contributions for
    // members routed strictly before the pivot. We fetch them and align them
    // to the persisted sequence rather than to board ordering.
    const parentContribs = await db
      .select()
      .from(sessionContributionsTable)
      .where(eq(sessionContributionsTable.sessionId, parent.id));

    const priorContribs = parentRoutedSeq
      .slice(0, pivotMemberPosition)
      .map((mid) => parentContribs.find((c) => c.boardMemberId === mid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const replayMemberIds = parentRoutedSeq.slice(pivotMemberPosition);

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
        pivotContributionId: pivot.id,
        allHands: parent.allHands,
      })
      .returning();

    // Inherit prior contributions verbatim (new ids, new sessionId).
    if (priorContribs.length > 0) {
      await db.insert(sessionContributionsTable).values(
        priorContribs.map((c) => ({
          sessionId: child.id,
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
        })),
      );
    }

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
      replayContext: {
        framing: parentSummary?.chairsFraming ?? "",
        facts: parent.establishedFactsText ?? "",
        replayMemberIds,
      },
    }).catch((err) => {
      req.log.error({ err, sessionId: child.id }, "Rewind runner crashed");
    });

    res.status(201).json(serializeSession(child));
    return;
  }

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

// ───── Build compare result (shared by authed + public share endpoints) ─────
type CompareValidation =
  | { ok: true; tenantId: string; sessions: (typeof advisorySessionsTable.$inferSelect)[] }
  | { ok: false; status: number; error: string };

async function loadCompareSessions(rawIds: string[]): Promise<CompareValidation> {
  const ids = Array.from(new Set(rawIds));
  if (ids.length < 2 || ids.length > 4) {
    return { ok: false, status: 400, error: "Provide 2-4 distinct session ids" };
  }
  const sessions = await db
    .select()
    .from(advisorySessionsTable)
    .where(inArray(advisorySessionsTable.id, ids));
  if (sessions.length !== ids.length) {
    return { ok: false, status: 404, error: "One or more sessions not found" };
  }
  const tenantIds = new Set(sessions.map((s) => s.tenantId));
  if (tenantIds.size !== 1) {
    return { ok: false, status: 400, error: "Sessions span multiple tenants" };
  }
  return { ok: true, tenantId: sessions[0].tenantId, sessions };
}

async function buildCompareResult(
  ids: string[],
  sessions: (typeof advisorySessionsTable.$inferSelect)[],
  reqLog: Request["log"],
) {
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
        logger: reqLog,
      });
      if (r.status === "complete") {
        deltaNote = r.text;
      } else {
        deltaNote = `_Master delta synthesis unavailable (${r.status}: ${r.errorDetail ?? ""})._`;
      }
    } catch (err) {
      reqLog.error({ err }, "Compare delta failed");
      deltaNote = "_Master delta synthesis failed._";
    }
  } else {
    deltaNote =
      "_At least two completed sessions are required for a delta synthesis. Showing what is available._";
  }

  return { entries, deltaNote, memberAlignments };
}

// ───── Compare 2-4 sessions ─────
router.post("/sessions/compare", async (req: Request, res: Response) => {
  const parsed = apiOps.CompareSessionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const ids = Array.from(new Set(parsed.data.sessionIds));
  const loaded = await loadCompareSessions(ids);
  if (!loaded.ok) {
    res.status(loaded.status).json({ error: loaded.error });
    return;
  }
  const ctx = await requireTenantRole(req, res, loaded.tenantId, "VIEWER");
  if (!ctx) return;
  const result = await buildCompareResult(ids, loaded.sessions, req.log);
  res.json(result);
});

// ───── Share link helpers ─────
function publicShareUrl(req: Request, token: string): string {
  const proxyDomain = (process.env["REPLIT_DOMAINS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (proxyDomain) return `https://${proxyDomain}/share/compare/${token}`;
  const host = req.get("host") ?? "localhost";
  const proto = (req.get("x-forwarded-proto") ?? req.protocol ?? "http").split(",")[0];
  return `${proto}://${host}/share/compare/${token}`;
}

function serializeShareLink(
  link: typeof sessionShareLinksTable.$inferSelect,
  req: Request,
) {
  return {
    id: link.id,
    tenantId: link.tenantId,
    token: link.token,
    sessionIds: link.sessionIds,
    createdBy: link.createdBy ?? null,
    createdAt: link.createdAt.toISOString(),
    revokedAt: link.revokedAt ? link.revokedAt.toISOString() : null,
    url: publicShareUrl(req, link.token),
  };
}

// ───── Create share link for a Compare view ─────
router.post("/sessions/compare/share", async (req: Request, res: Response) => {
  const parsed = apiOps.CreateCompareShareLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const ids = Array.from(new Set(parsed.data.sessionIds));
  const loaded = await loadCompareSessions(ids);
  if (!loaded.ok) {
    res.status(loaded.status).json({ error: loaded.error });
    return;
  }
  const ctx = await requireTenantRole(req, res, loaded.tenantId, "EDITOR");
  if (!ctx) return;

  const token = crypto.randomBytes(32).toString("base64url");
  const [link] = await db
    .insert(sessionShareLinksTable)
    .values({
      tenantId: loaded.tenantId,
      token,
      sessionIds: ids,
      createdBy: ctx.userId,
    })
    .returning();

  res.status(201).json(serializeShareLink(link, req));
});

// ───── Public — render compare by share token ─────
router.get("/share/compare/:token", async (req: Request, res: Response) => {
  const token = req.params.token as string;
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const [link] = await db
    .select()
    .from(sessionShareLinksTable)
    .where(eq(sessionShareLinksTable.token, token))
    .limit(1);
  if (!link || link.revokedAt) {
    res.status(404).json({ error: "Share link not found or revoked" });
    return;
  }
  const loaded = await loadCompareSessions(link.sessionIds);
  if (!loaded.ok) {
    res.status(loaded.status).json({ error: loaded.error });
    return;
  }
  const result = await buildCompareResult(
    link.sessionIds,
    loaded.sessions,
    req.log,
  );
  // Public — disable caching of personalized content
  res.setHeader("Cache-Control", "no-store");
  res.json(result);
});

// ───── List active share links for a tenant ─────
router.get(
  "/tenants/:tenantId/share-links",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;
    const rows = await db
      .select()
      .from(sessionShareLinksTable)
      .where(
        and(
          eq(sessionShareLinksTable.tenantId, tenantId),
          isNull(sessionShareLinksTable.revokedAt),
        ),
      )
      .orderBy(desc(sessionShareLinksTable.createdAt));
    res.json(rows.map((l) => serializeShareLink(l, req)));
  },
);

// ───── Revoke a share link ─────
router.delete(
  "/tenants/:tenantId/share-links/:shareLinkId",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const shareLinkId = req.params.shareLinkId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "EDITOR");
    if (!ctx) return;
    const [link] = await db
      .select()
      .from(sessionShareLinksTable)
      .where(
        and(
          eq(sessionShareLinksTable.id, shareLinkId),
          eq(sessionShareLinksTable.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!link) {
      res.status(404).json({ error: "Share link not found" });
      return;
    }
    if (!link.revokedAt) {
      await db
        .update(sessionShareLinksTable)
        .set({ revokedAt: new Date() })
        .where(eq(sessionShareLinksTable.id, shareLinkId));
    }
    res.status(204).end();
  },
);

export default router;
