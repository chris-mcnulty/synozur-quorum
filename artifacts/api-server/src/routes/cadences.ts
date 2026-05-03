import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  cadencesTable,
  cadenceRunsTable,
  boardsTable,
  type Cadence,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { apiOps } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import { computeNextRun } from "../lib/cadenceSchedule";
import { fireCadence } from "../lib/cadenceScheduler";

const router: IRouter = Router();

function validateScheduleInvariants(args: {
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}): string | null {
  if (args.frequency === "MONTHLY") {
    if (args.dayOfMonth == null) {
      return "dayOfMonth is required for MONTHLY cadences";
    }
    if (args.dayOfMonth < 1 || args.dayOfMonth > 28) {
      return "dayOfMonth must be between 1 and 28";
    }
  } else {
    if (args.dayOfWeek == null) {
      return `dayOfWeek is required for ${args.frequency} cadences`;
    }
    if (args.dayOfWeek < 0 || args.dayOfWeek > 6) {
      return "dayOfWeek must be between 0 and 6";
    }
  }
  return null;
}

function serializeCadence(c: Cadence) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    boardId: c.boardId,
    name: c.name,
    frequency: c.frequency,
    dayOfWeek: c.dayOfWeek,
    dayOfMonth: c.dayOfMonth,
    hour: c.hour,
    minute: c.minute,
    timezone: c.timezone,
    mode: c.mode,
    questionTemplate: c.questionTemplate,
    templateVariables: c.templateVariables ?? {},
    recipients: c.recipients ?? [],
    paused: c.paused,
    nextRunAt: c.nextRunAt ? c.nextRunAt.toISOString() : null,
    lastRunAt: c.lastRunAt ? c.lastRunAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/boards/:boardId/cadences", async (req: Request, res: Response) => {
  const boardId = req.params.boardId as string;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
  if (!ctx) return;

  const rows = await db
    .select()
    .from(cadencesTable)
    .where(eq(cadencesTable.boardId, boardId))
    .orderBy(desc(cadencesTable.createdAt));
  res.json(rows.map(serializeCadence));
});

router.post(
  "/boards/:boardId/cadences",
  async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, boardId))
      .limit(1);
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, board.tenantId, "EDITOR");
    if (!ctx) return;

    const parsed = apiOps.CreateCadenceBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request body", detail: parsed.error.message });
      return;
    }

    const data = parsed.data;
    const invErr = validateScheduleInvariants({
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth,
    });
    if (invErr) {
      res.status(400).json({ error: invErr });
      return;
    }
    // Normalize: clear the inapplicable schedule field for the chosen frequency.
    const dayOfWeek =
      data.frequency === "MONTHLY" ? null : (data.dayOfWeek as number);
    const dayOfMonth =
      data.frequency === "MONTHLY" ? (data.dayOfMonth as number) : null;
    const nextRun = computeNextRun(new Date(), {
      frequency: data.frequency,
      dayOfWeek,
      dayOfMonth,
      hour: data.hour,
      minute: data.minute,
      timezone: data.timezone,
    });

    const [row] = await db
      .insert(cadencesTable)
      .values({
        tenantId: board.tenantId,
        boardId,
        name: data.name,
        frequency: data.frequency,
        dayOfWeek,
        dayOfMonth,
        hour: data.hour,
        minute: data.minute,
        timezone: data.timezone,
        mode: data.mode,
        questionTemplate: data.questionTemplate,
        templateVariables: data.templateVariables ?? {},
        recipients: data.recipients ?? [],
        nextRunAt: nextRun,
        createdBy: ctx.userId,
      })
      .returning();
    res.status(201).json(serializeCadence(row));
  },
);

router.patch("/cadences/:cadenceId", async (req: Request, res: Response) => {
  const cadenceId = req.params.cadenceId as string;
  const [existing] = await db
    .select()
    .from(cadencesTable)
    .where(eq(cadencesTable.id, cadenceId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Cadence not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, existing.tenantId, "EDITOR");
  if (!ctx) return;

  const parsed = apiOps.UpdateCadenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const d = parsed.data;
  const updates: Partial<typeof cadencesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (d.name != null) updates.name = d.name;
  if (d.frequency != null) updates.frequency = d.frequency;
  if (d.dayOfWeek !== undefined) updates.dayOfWeek = d.dayOfWeek;
  if (d.dayOfMonth !== undefined) updates.dayOfMonth = d.dayOfMonth;
  // After applying frequency/dayOfWeek/dayOfMonth, enforce invariants and
  // normalize incompatible fields. We must consider the resulting frequency,
  // not just what was sent in this PATCH.
  {
    const freq = (updates.frequency ?? existing.frequency) as
      | "WEEKLY"
      | "BIWEEKLY"
      | "MONTHLY";
    const effDow =
      updates.dayOfWeek !== undefined ? updates.dayOfWeek : existing.dayOfWeek;
    const effDom =
      updates.dayOfMonth !== undefined
        ? updates.dayOfMonth
        : existing.dayOfMonth;
    if (freq === "MONTHLY") {
      if (effDom == null) {
        res
          .status(400)
          .json({ error: "dayOfMonth is required for MONTHLY cadences" });
        return;
      }
      updates.dayOfWeek = null;
    } else {
      if (effDow == null) {
        res
          .status(400)
          .json({ error: `dayOfWeek is required for ${freq} cadences` });
        return;
      }
      updates.dayOfMonth = null;
    }
    const invErr = validateScheduleInvariants({
      frequency: freq,
      dayOfWeek: freq === "MONTHLY" ? null : effDow,
      dayOfMonth: freq === "MONTHLY" ? effDom : null,
    });
    if (invErr) {
      res.status(400).json({ error: invErr });
      return;
    }
  }
  if (d.hour != null) updates.hour = d.hour;
  if (d.minute != null) updates.minute = d.minute;
  if (d.timezone != null) updates.timezone = d.timezone;
  if (d.mode != null) updates.mode = d.mode;
  if (d.questionTemplate != null)
    updates.questionTemplate = d.questionTemplate;
  if (d.templateVariables !== undefined && d.templateVariables !== null)
    updates.templateVariables = d.templateVariables;
  if (d.recipients !== undefined && d.recipients !== null)
    updates.recipients = d.recipients;
  if (d.paused !== undefined && d.paused !== null) updates.paused = d.paused;

  // Recompute next_run if schedule changed or unpausing
  const merged = { ...existing, ...updates };
  const scheduleChanged =
    d.frequency != null ||
    d.dayOfWeek !== undefined ||
    d.dayOfMonth !== undefined ||
    d.hour != null ||
    d.minute != null ||
    d.timezone != null ||
    (d.paused === false && existing.paused);
  if (scheduleChanged && !merged.paused) {
    updates.nextRunAt = computeNextRun(new Date(), {
      frequency: (updates.frequency ?? existing.frequency) as
        | "WEEKLY"
        | "BIWEEKLY"
        | "MONTHLY",
      dayOfWeek: updates.dayOfWeek ?? existing.dayOfWeek,
      dayOfMonth: updates.dayOfMonth ?? existing.dayOfMonth,
      hour: updates.hour ?? existing.hour,
      minute: updates.minute ?? existing.minute,
      timezone: updates.timezone ?? existing.timezone,
      lastRunAt: existing.lastRunAt,
    });
  }
  if (d.paused === true) {
    updates.nextRunAt = null;
  }

  const [row] = await db
    .update(cadencesTable)
    .set(updates)
    .where(eq(cadencesTable.id, cadenceId))
    .returning();
  res.json(serializeCadence(row));
});

router.delete("/cadences/:cadenceId", async (req: Request, res: Response) => {
  const cadenceId = req.params.cadenceId as string;
  const [existing] = await db
    .select()
    .from(cadencesTable)
    .where(eq(cadencesTable.id, cadenceId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Cadence not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, existing.tenantId, "EDITOR");
  if (!ctx) return;
  await db.delete(cadencesTable).where(eq(cadencesTable.id, cadenceId));
  res.status(204).end();
});

router.get(
  "/cadences/:cadenceId/runs",
  async (req: Request, res: Response) => {
    const cadenceId = req.params.cadenceId as string;
    const [existing] = await db
      .select()
      .from(cadencesTable)
      .where(eq(cadencesTable.id, cadenceId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Cadence not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, existing.tenantId, "VIEWER");
    if (!ctx) return;
    const runs = await db
      .select()
      .from(cadenceRunsTable)
      .where(eq(cadenceRunsTable.cadenceId, cadenceId))
      .orderBy(desc(cadenceRunsTable.startedAt))
      .limit(10);
    res.json(
      runs.map((r) => ({
        id: r.id,
        cadenceId: r.cadenceId,
        sessionId: r.sessionId,
        status: r.status,
        scheduledFor: r.scheduledFor.toISOString(),
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        deliveryStatus: r.deliveryStatus ?? null,
        errorDetail: r.errorDetail ?? null,
      })),
    );
  },
);

// Manual trigger for testing — fires the cadence immediately (still subject to scheduler claim).
router.post(
  "/cadences/:cadenceId/run-now",
  async (req: Request, res: Response) => {
    const cadenceId = req.params.cadenceId as string;
    const [existing] = await db
      .select()
      .from(cadencesTable)
      .where(eq(cadencesTable.id, cadenceId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Cadence not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, existing.tenantId, "EDITOR");
    if (!ctx) return;
    void fireCadence(cadenceId).catch(() => {});
    res.status(202).json({ ok: true });
  },
);

export default router;
