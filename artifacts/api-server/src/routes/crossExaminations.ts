import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  advisorySessionsTable,
  sessionSummariesTable,
  sessionContributionsTable,
  boardsTable,
  boardMembersTable,
  crossExaminationsTable,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { apiOps } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import { extractTextFromObject } from "../lib/textExtract";
import {
  runCrossExamination,
  subscribeToCrossExam,
  type CrossExamProgressEvent,
} from "../lib/crossExaminationRunner";

const router: IRouter = Router();

function serializeCrossExam(
  c: typeof crossExaminationsTable.$inferSelect,
  boardCount: number,
) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    questionText: c.questionText,
    mode: c.mode,
    status: c.status,
    boardCount,
    startedAt: c.startedAt.toISOString(),
    completedAt: c.completedAt ? c.completedAt.toISOString() : null,
    totalCostCents: c.totalCostCents ?? null,
  };
}

router.get(
  "/tenants/:tenantId/cross-examinations",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;

    const rows = await db
      .select()
      .from(crossExaminationsTable)
      .where(eq(crossExaminationsTable.tenantId, tenantId))
      .orderBy(desc(crossExaminationsTable.startedAt));

    const ids = rows.map((r) => r.id);
    const childCounts = new Map<string, number>();
    if (ids.length) {
      const children = await db
        .select({
          crossExaminationId: advisorySessionsTable.crossExaminationId,
          id: advisorySessionsTable.id,
        })
        .from(advisorySessionsTable)
        .where(inArray(advisorySessionsTable.crossExaminationId, ids));
      for (const c of children) {
        if (!c.crossExaminationId) continue;
        childCounts.set(
          c.crossExaminationId,
          (childCounts.get(c.crossExaminationId) ?? 0) + 1,
        );
      }
    }

    res.json(rows.map((r) => serializeCrossExam(r, childCounts.get(r.id) ?? 0)));
  },
);

router.post(
  "/tenants/:tenantId/cross-examinations",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "EDITOR");
    if (!ctx) return;

    const parsed = apiOps.CreateCrossExaminationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const {
      questionText,
      boardIds,
      mode,
      questionDocumentPath,
      questionDocumentFilename,
      questionDocumentContentType,
    } = parsed.data;
    const dedupedIds = Array.from(new Set(boardIds));
    if (dedupedIds.length < 2 || dedupedIds.length > 4) {
      res.status(400).json({ error: "Select between 2 and 4 boards" });
      return;
    }

    const boards = await db
      .select()
      .from(boardsTable)
      .where(inArray(boardsTable.id, dedupedIds));

    if (boards.length !== dedupedIds.length) {
      res.status(400).json({ error: "One or more boards not found" });
      return;
    }
    if (boards.some((b) => b.tenantId !== tenantId)) {
      res.status(403).json({ error: "All boards must belong to the tenant" });
      return;
    }

    // Ensure each board has at least one member.
    const memberRows = await db
      .select({ boardId: boardMembersTable.boardId })
      .from(boardMembersTable)
      .where(inArray(boardMembersTable.boardId, dedupedIds));
    const memberCount = new Map<string, number>();
    for (const r of memberRows)
      memberCount.set(r.boardId, (memberCount.get(r.boardId) ?? 0) + 1);
    const empties = boards.filter((b) => (memberCount.get(b.id) ?? 0) === 0);
    if (empties.length) {
      res.status(400).json({
        error: `Board(s) without members: ${empties.map((b) => b.name).join(", ")}`,
      });
      return;
    }

    const [crossExam] = await db
      .insert(crossExaminationsTable)
      .values({
        tenantId,
        questionText,
        mode,
        status: "running",
        createdBy: ctx.userId,
      })
      .returning();

    // Create child session rows, each linked to this cross-exam.
    const childRows = await Promise.all(
      dedupedIds.map(async (boardId) => {
        const [s] = await db
          .insert(advisorySessionsTable)
          .values({
            tenantId,
            boardId,
            crossExaminationId: crossExam.id,
            mode,
            questionText,
            status: "running",
            createdBy: ctx.userId,
          })
          .returning();
        return { sessionId: s.id, boardId };
      }),
    );

    let questionDocumentText: string | undefined;
    if (questionDocumentPath && questionDocumentContentType) {
      try {
        const extracted = await extractTextFromObject(
          questionDocumentPath,
          questionDocumentContentType,
        );
        questionDocumentText = extracted.text || undefined;
      } catch (err) {
        req.log.warn({ err, questionDocumentPath }, "Could not extract cross-exam document text");
      }
    }

    void runCrossExamination({
      crossExamId: crossExam.id,
      tenantId,
      boardIds: dedupedIds,
      mode,
      question: questionText,
      questionDocumentText,
      childSessions: childRows,
    }).catch((err) => {
      req.log.error({ err, crossExamId: crossExam.id }, "Cross-exam crashed");
    });

    res
      .status(201)
      .json(serializeCrossExam(crossExam, dedupedIds.length));
  },
);

router.get(
  "/cross-examinations/:crossExamId",
  async (req: Request, res: Response) => {
    const id = req.params.crossExamId as string;
    const [crossExam] = await db
      .select()
      .from(crossExaminationsTable)
      .where(eq(crossExaminationsTable.id, id))
      .limit(1);
    if (!crossExam) {
      res.status(404).json({ error: "Cross-examination not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, crossExam.tenantId, "VIEWER");
    if (!ctx) return;

    const childSessions = await db
      .select()
      .from(advisorySessionsTable)
      .where(eq(advisorySessionsTable.crossExaminationId, id))
      .orderBy(advisorySessionsTable.startedAt);

    const childIds = childSessions.map((s) => s.id);
    const summaries = childIds.length
      ? await db
          .select()
          .from(sessionSummariesTable)
          .where(inArray(sessionSummariesTable.sessionId, childIds))
      : [];
    const summaryMap = new Map(summaries.map((s) => [s.sessionId, s]));

    const contribRows = childIds.length
      ? await db
          .select({ sessionId: sessionContributionsTable.sessionId })
          .from(sessionContributionsTable)
          .where(inArray(sessionContributionsTable.sessionId, childIds))
      : [];
    const contribCount = new Map<string, number>();
    for (const r of contribRows)
      contribCount.set(r.sessionId, (contribCount.get(r.sessionId) ?? 0) + 1);

    const boardIds = childSessions.map((s) => s.boardId);
    const boards = boardIds.length
      ? await db
          .select()
          .from(boardsTable)
          .where(inArray(boardsTable.id, boardIds))
      : [];
    const boardMap = new Map(boards.map((b) => [b.id, b]));

    const children = childSessions.map((s) => {
      const summary = summaryMap.get(s.id);
      const board = boardMap.get(s.boardId);
      return {
        sessionId: s.id,
        boardId: s.boardId,
        boardName: board?.name ?? "Unknown",
        status: s.status,
        convergenceNote: summary?.convergenceNote ?? null,
        finalSummary: summary?.finalSummary ?? null,
        contributionCount: contribCount.get(s.id) ?? 0,
      };
    });

    let alignmentMatrix: unknown[] = [];
    let uniqueInsights: unknown[] = [];
    try {
      if (crossExam.alignmentMatrixJson)
        alignmentMatrix = JSON.parse(crossExam.alignmentMatrixJson);
    } catch {}
    try {
      if (crossExam.uniqueInsightsJson)
        uniqueInsights = JSON.parse(crossExam.uniqueInsightsJson);
    } catch {}

    res.json({
      crossExamination: serializeCrossExam(crossExam, childSessions.length),
      children,
      alignmentMatrix,
      uniqueInsights,
      metaRecommendation: crossExam.metaRecommendation ?? null,
      synthesisNarrative: crossExam.synthesisNarrative ?? null,
    });
  },
);

// SSE — streams per-child progress + final synthesis
router.get(
  "/cross-examinations/:crossExamId/stream",
  async (req: Request, res: Response) => {
    const id = req.params.crossExamId as string;
    const [crossExam] = await db
      .select()
      .from(crossExaminationsTable)
      .where(eq(crossExaminationsTable.id, id))
      .limit(1);
    if (!crossExam) {
      res.status(404).json({ error: "Cross-examination not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, crossExam.tenantId, "VIEWER");
    if (!ctx) return;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (e: CrossExamProgressEvent) => {
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
      const payload = {
        phase: e.type,
        ...(typeof e.payload === "object" && e.payload !== null
          ? e.payload
          : {}),
      };
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    if (crossExam.status !== "running") {
      send({
        type: "complete",
        crossExamId: id,
        payload: { alreadyComplete: true, status: crossExam.status },
      });
      res.end();
      return;
    }

    const unsubscribe = subscribeToCrossExam(id, send);
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  },
);

export default router;
