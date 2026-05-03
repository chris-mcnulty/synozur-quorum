import {
  db,
  cadencesTable,
  cadenceRunsTable,
  advisorySessionsTable,
  sessionSummariesTable,
  sessionContributionsTable,
  boardsTable,
  boardMembersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { runSession } from "./sessionRunner";
import { computeNextRun, renderTemplate } from "./cadenceSchedule";
import { sendDigestEmail, renderDigestHtml } from "./email";

let started = false;
let timer: NodeJS.Timeout | null = null;

const TICK_INTERVAL_MS = 60_000;
const LOCK_STALE_MS = 10 * 60_000;

export function startCadenceScheduler() {
  if (started) return;
  started = true;
  logger.info("Cadence scheduler starting");
  // Kick once shortly after boot, then every minute.
  timer = setTimeout(function tick() {
    void runDueCadences().catch((err) =>
      logger.error({ err }, "Cadence tick failed"),
    );
    timer = setTimeout(tick, TICK_INTERVAL_MS);
  }, 5_000);
}

export function stopCadenceScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
}

async function claimDueCadence(now: Date): Promise<string | null> {
  // Atomically pick one due cadence and stamp its lockedAt to claim ownership.
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS);
  const result = await db.execute(sql`
    UPDATE cadences
    SET locked_at = ${now}
    WHERE id = (
      SELECT id FROM cadences
      WHERE paused = false
        AND next_run_at IS NOT NULL
        AND next_run_at <= ${now}
        AND (locked_at IS NULL OR locked_at < ${staleBefore})
      ORDER BY next_run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
  `);
  // node-postgres returns rows in .rows
  const rows = (result as unknown as { rows: Array<{ id: string }> }).rows;
  return rows[0]?.id ?? null;
}

export async function runDueCadences() {
  const now = new Date();
  // Drain up to N cadences per tick to keep things bounded.
  for (let i = 0; i < 10; i++) {
    const id = await claimDueCadence(now);
    if (!id) return;
    try {
      await fireCadence(id);
    } catch (err) {
      logger.error({ err, cadenceId: id }, "fireCadence failed");
    }
  }
}

function publicBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost";
}

export async function fireCadence(cadenceId: string) {
  const log = logger.child({ cadenceId });
  const [cadence] = await db
    .select()
    .from(cadencesTable)
    .where(eq(cadencesTable.id, cadenceId))
    .limit(1);
  if (!cadence) return;

  const scheduledFor = cadence.nextRunAt ?? new Date();

  const [run] = await db
    .insert(cadenceRunsTable)
    .values({
      cadenceId,
      status: "running",
      scheduledFor,
    })
    .returning();

  // Compute and persist next run immediately so missed minutes don't double-fire.
  const nextRun = computeNextRun(new Date(), {
    frequency:
      cadence.frequency as "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    dayOfWeek: cadence.dayOfWeek,
    dayOfMonth: cadence.dayOfMonth,
    hour: cadence.hour,
    minute: cadence.minute,
    timezone: cadence.timezone,
    lastRunAt: new Date(),
  });
  await db
    .update(cadencesTable)
    .set({
      lastRunAt: new Date(),
      nextRunAt: nextRun,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(cadencesTable.id, cadenceId));

  try {
    // Confirm board still has members
    const members = await db
      .select({ id: boardMembersTable.id })
      .from(boardMembersTable)
      .where(eq(boardMembersTable.boardId, cadence.boardId));
    if (members.length === 0) {
      throw new Error("Board has no members");
    }

    const question = renderTemplate(
      cadence.questionTemplate,
      cadence.templateVariables ?? {},
    );

    const [session] = await db
      .insert(advisorySessionsTable)
      .values({
        tenantId: cadence.tenantId,
        boardId: cadence.boardId,
        mode: cadence.mode,
        questionText: question,
        status: "running",
        createdBy: cadence.createdBy,
      })
      .returning();

    await db
      .update(cadenceRunsTable)
      .set({ sessionId: session.id })
      .where(eq(cadenceRunsTable.id, run.id));

    log.info({ sessionId: session.id }, "Cadence firing session");

    // Run synchronously (we're already off the request path).
    const sessionMode = cadence.mode as "ADVISORY" | "BOARD" | "REVIEW";
    const sessionPromise = runSession({
      sessionId: session.id,
      tenantId: cadence.tenantId,
      boardId: cadence.boardId,
      mode: sessionMode,
      question,
      allHands: false,
    });
    // Wait for completion
    await sessionPromise;

    // Re-read session + summary for digest
    const [finalSession] = await db
      .select()
      .from(advisorySessionsTable)
      .where(eq(advisorySessionsTable.id, session.id))
      .limit(1);
    const [summary] = await db
      .select()
      .from(sessionSummariesTable)
      .where(eq(sessionSummariesTable.sessionId, session.id))
      .limit(1);
    const [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, cadence.boardId))
      .limit(1);

    let voteSummary: string | null = null;
    if (cadence.mode === "BOARD") {
      const contribs = await db
        .select()
        .from(sessionContributionsTable)
        .where(eq(sessionContributionsTable.sessionId, session.id));
      const voted = contribs.filter((c) => c.vote);
      const tally = { YES: 0, NO: 0, ABSTAIN: 0 } as Record<string, number>;
      for (const c of voted) {
        const v = String(c.vote).toUpperCase();
        if (v in tally) tally[v]++;
      }
      const tallyLine = `Tally — YES: ${tally.YES}  ·  NO: ${tally.NO}  ·  ABSTAIN: ${tally.ABSTAIN}`;
      const lines = voted.map(
        (c) =>
          `${c.memberName ?? "Member"} (${c.memberRoleTitle ?? ""}): ${c.vote}${c.voteRationale ? ` — ${c.voteRationale}` : ""}`,
      );
      voteSummary = [tallyLine, "", ...lines].filter(Boolean).join("\n");
    }

    const sessionLink = `${publicBaseUrl()}/sessions/${session.id}`;
    const { text, html } = renderDigestHtml({
      boardName: board?.name ?? "Board",
      cadenceName: cadence.name,
      question,
      convergenceNote: summary?.convergenceNote ?? "",
      finalSummary: summary?.finalSummary ?? "",
      voteSummary,
      sessionLink,
    });

    const delivery = await sendDigestEmail({
      to: cadence.recipients ?? [],
      subject: `[Quorum] ${cadence.name} — ${board?.name ?? ""}`,
      text,
      html,
    });

    const finalStatus =
      finalSession?.status === "failed" ? "failed" : "complete";
    await db
      .update(cadenceRunsTable)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        deliveryStatus: delivery.status,
      })
      .where(eq(cadenceRunsTable.id, run.id));

    log.info(
      { sessionId: session.id, deliveryStatus: delivery.status },
      "Cadence run complete",
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    log.error({ err }, "Cadence run failed");
    await db
      .update(cadenceRunsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorDetail: e?.message ?? "unknown error",
      })
      .where(eq(cadenceRunsTable.id, run.id));
  }
}

