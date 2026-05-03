import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  groundingSelectorsTable,
  groundingRefreshDiffsTable,
  tenantMembersTable,
  tenantNotificationsTable,
  type GroundingSelector,
} from "@workspace/db";
import { fetchSnapshot } from "./index";
import type { GroundingProvider } from "./types";
import { logger as rootLogger } from "../logger";

const log = rootLogger.child({ component: "grounding-refresh" });

const SNIPPET_MAX = 600;
const TOKEN_DELTA_RATIO = 0.1;
const TOKEN_DELTA_FLOOR = 50;

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function isMaterialChange(
  prevHash: string | null,
  newHash: string,
  prevTokens: number | null,
  newTokens: number,
  newStatus: string,
): boolean {
  if (newStatus !== "ok") return true;
  if (prevHash === null) return false;
  if (prevHash === newHash) return false;
  if (prevTokens === null) return false;
  const delta = Math.abs(newTokens - prevTokens);
  const ratioThreshold = Math.max(
    TOKEN_DELTA_FLOOR,
    prevTokens * TOKEN_DELTA_RATIO,
  );
  return delta >= ratioThreshold;
}

function classifyChange(
  prevHash: string | null,
  newHash: string,
  status: string,
): string {
  if (status !== "ok") return "fetch_error";
  if (prevHash === null) return "initial";
  if (prevHash === newHash) return "unchanged";
  return "content_changed";
}

export interface RefreshResult {
  selectorId: string;
  changeKind: string;
  materiallyChanged: boolean;
  diffId: string | null;
  fetchStatus: string;
}

export async function refreshSelector(
  selector: GroundingSelector,
): Promise<RefreshResult> {
  const provider = selector.provider as GroundingProvider;
  const result = await fetchSnapshot({
    provider,
    query: (selector.queryJson ?? {}) as Record<string, unknown>,
    tokenBudget: selector.tokenBudget,
  });
  const newHash = hashContent(result.contentText);
  const prevHash = selector.lastContentHash;
  const prevTokens = selector.lastTokenEstimate;
  const status = result.status;
  const changeKind = classifyChange(prevHash, newHash, status);
  const recordDiff = changeKind !== "unchanged" || status !== "ok";
  const material = isMaterialChange(
    prevHash,
    newHash,
    prevTokens,
    result.tokenEstimate,
    status,
  );

  let diffId: string | null = null;
  if (recordDiff) {
    const snippet = result.contentText.slice(0, SNIPPET_MAX);
    const [row] = await db
      .insert(groundingRefreshDiffsTable)
      .values({
        tenantId: selector.tenantId,
        selectorId: selector.id,
        boardId: selector.boardId,
        boardMemberId: selector.boardMemberId,
        provider,
        selectorName: selector.name,
        previousHash: prevHash,
        newHash,
        previousTokenEstimate: prevTokens,
        newTokenEstimate: result.tokenEstimate,
        changeKind,
        materiallyChanged: material,
        fetchStatus: status,
        errorDetail: result.errorDetail ?? null,
        contentSnippet: snippet,
      })
      .returning();
    diffId = row.id;
  }

  await db
    .update(groundingSelectorsTable)
    .set({
      lastRefreshedAt: new Date(),
      lastContentHash: status === "ok" ? newHash : prevHash,
      lastTokenEstimate:
        status === "ok" ? result.tokenEstimate : prevTokens,
    })
    .where(eq(groundingSelectorsTable.id, selector.id));

  if (material && diffId) {
    await notifyOwners(selector, diffId, changeKind, status, result.errorDetail);
  }

  return {
    selectorId: selector.id,
    changeKind,
    materiallyChanged: material,
    diffId,
    fetchStatus: status,
  };
}

async function notifyOwners(
  selector: GroundingSelector,
  diffId: string,
  changeKind: string,
  status: string,
  errorDetail: string | null | undefined,
): Promise<void> {
  const owners = await db
    .select({ userId: tenantMembersTable.userId })
    .from(tenantMembersTable)
    .where(
      and(
        eq(tenantMembersTable.tenantId, selector.tenantId),
        inArray(tenantMembersTable.role, ["OWNER", "ADMIN"]),
      ),
    );
  if (owners.length === 0) return;
  const isError = status !== "ok";
  const title = isError
    ? `Grounding fetch failed: ${selector.name}`
    : `Grounding source updated: ${selector.name}`;
  const body = isError
    ? `Auto-refresh of "${selector.name}" returned status ${status}${
        errorDetail ? `: ${errorDetail}` : "."
      }`
    : `"${selector.name}" (${selector.provider}) changed materially since the last refresh. Review the diff before the next session.`;
  await db.insert(tenantNotificationsTable).values(
    owners.map((o) => ({
      tenantId: selector.tenantId,
      userId: o.userId,
      kind: "grounding_refresh_diff",
      title,
      body,
      refType: "grounding_refresh_diff" as const,
      refId: diffId,
      payload: {
        selectorId: selector.id,
        boardId: selector.boardId,
        boardMemberId: selector.boardMemberId,
        provider: selector.provider,
        changeKind,
        fetchStatus: status,
      },
    })),
  );
}

export interface SchedulerOptions {
  intervalMs: number;
  staleAfterMs: number;
  batchSize: number;
}

export const DEFAULT_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_REFRESH_TICK_MS = 15 * 60 * 1000;
const DEFAULT_BATCH = 25;

export async function runDueRefreshes(
  opts: Pick<SchedulerOptions, "staleAfterMs" | "batchSize">,
): Promise<RefreshResult[]> {
  const cutoff = new Date(Date.now() - opts.staleAfterMs);
  const due = await db
    .select()
    .from(groundingSelectorsTable)
    .where(
      and(
        eq(groundingSelectorsTable.autoRefreshEnabled, true),
        or(
          isNull(groundingSelectorsTable.lastRefreshedAt),
          lte(groundingSelectorsTable.lastRefreshedAt, cutoff),
        ),
      ),
    )
    .orderBy(
      sql`${groundingSelectorsTable.lastRefreshedAt} ASC NULLS FIRST`,
      asc(groundingSelectorsTable.id),
    )
    .limit(opts.batchSize);

  const results: RefreshResult[] = [];
  for (const sel of due) {
    try {
      const r = await refreshSelector(sel);
      results.push(r);
      if (r.materiallyChanged) {
        log.info(
          {
            selectorId: sel.id,
            tenantId: sel.tenantId,
            boardId: sel.boardId,
            changeKind: r.changeKind,
          },
          "Grounding selector materially changed",
        );
      }
    } catch (err) {
      log.error({ err, selectorId: sel.id }, "Refresh selector failed");
    }
  }
  return results;
}

let timer: NodeJS.Timeout | null = null;

export function startRefreshScheduler(
  opts: Partial<SchedulerOptions> = {},
): void {
  if (timer) return;
  const intervalMs =
    opts.intervalMs ??
    Number(
      process.env["GROUNDING_REFRESH_TICK_MS"] ?? DEFAULT_REFRESH_TICK_MS,
    );
  const staleAfterMs =
    opts.staleAfterMs ??
    Number(
      process.env["GROUNDING_REFRESH_INTERVAL_MS"] ??
        DEFAULT_REFRESH_INTERVAL_MS,
    );
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    log.info("Grounding refresh scheduler disabled (intervalMs <= 0)");
    return;
  }

  log.info({ intervalMs, staleAfterMs, batchSize }, "Starting grounding refresh scheduler");

  const tick = async () => {
    try {
      const results = await runDueRefreshes({ staleAfterMs, batchSize });
      if (results.length > 0) {
        const material = results.filter((r) => r.materiallyChanged).length;
        log.info(
          { processed: results.length, material },
          "Grounding refresh tick complete",
        );
      }
    } catch (err) {
      log.error({ err }, "Grounding refresh tick failed");
    }
  };

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();

  setTimeout(() => {
    void tick();
  }, 5_000).unref?.();
}

export function stopRefreshScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
