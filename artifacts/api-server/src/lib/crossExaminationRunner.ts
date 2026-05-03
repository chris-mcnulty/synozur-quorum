import {
  db,
  advisorySessionsTable,
  sessionContributionsTable,
  sessionSummariesTable,
  boardsTable,
  crossExaminationsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  callClaude,
  computeCostCents,
  MASTER_MODEL_DEFAULT,
} from "./anthropic";
import { logger as rootLogger } from "./logger";
import {
  runSession,
  subscribeToSession,
  type ProgressEvent,
  type SessionMode,
} from "./sessionRunner";

export interface CrossExamProgressEvent {
  type:
    | "started"
    | "child_event"
    | "child_complete"
    | "synthesis"
    | "complete"
    | "error";
  crossExamId: string;
  payload?: unknown;
}

type Subscriber = (e: CrossExamProgressEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribeToCrossExam(
  crossExamId: string,
  cb: Subscriber,
): () => void {
  let set = subscribers.get(crossExamId);
  if (!set) {
    set = new Set();
    subscribers.set(crossExamId, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) subscribers.delete(crossExamId);
  };
}

function emit(crossExamId: string, event: CrossExamProgressEvent) {
  const set = subscribers.get(crossExamId);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(event);
    } catch {
      // ignore
    }
  }
}

function tryParseJson<T = unknown>(s: string): T | null {
  const fence = s.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : s;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const m = candidate.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface RunOptions {
  crossExamId: string;
  tenantId: string;
  boardIds: string[];
  mode: SessionMode;
  question: string;
  childSessions: { sessionId: string; boardId: string }[];
}

interface SynthesisPayload {
  alignmentMatrix?: Array<{
    topic: string;
    verdicts: Array<{ boardId: string; boardName: string; stance: string }>;
  }>;
  uniqueInsights?: Array<{
    boardId: string;
    boardName: string;
    insight: string;
  }>;
  metaRecommendation?: string;
  synthesisNarrative?: string;
}

export async function runCrossExamination(opts: RunOptions): Promise<void> {
  const log = rootLogger.child({ crossExamId: opts.crossExamId });
  emit(opts.crossExamId, {
    type: "started",
    crossExamId: opts.crossExamId,
    payload: { childSessions: opts.childSessions },
  });

  try {
    // Subscribe to each child session and forward events.
    const unsubscribers: Array<() => void> = [];
    for (const child of opts.childSessions) {
      const unsub = subscribeToSession(child.sessionId, (e: ProgressEvent) => {
        emit(opts.crossExamId, {
          type: "child_event",
          crossExamId: opts.crossExamId,
          payload: {
            sessionId: child.sessionId,
            boardId: child.boardId,
            event: e,
          },
        });
      });
      unsubscribers.push(unsub);
    }

    // Kick off all child sessions in parallel.
    const childRuns = opts.childSessions.map((child) =>
      runSession({
        sessionId: child.sessionId,
        tenantId: opts.tenantId,
        boardId: child.boardId,
        mode: opts.mode,
        question: opts.question,
        allHands: false,
      })
        .then(() => {
          emit(opts.crossExamId, {
            type: "child_complete",
            crossExamId: opts.crossExamId,
            payload: { sessionId: child.sessionId, boardId: child.boardId },
          });
        })
        .catch((err) => {
          log.error({ err, sessionId: child.sessionId }, "Child session crashed");
        }),
    );

    await Promise.all(childRuns);
    for (const u of unsubscribers) u();

    // Load each child's board name and summary.
    const childIds = opts.childSessions.map((c) => c.sessionId);
    const boards = await db
      .select()
      .from(boardsTable)
      .where(inArray(boardsTable.id, opts.boardIds));
    const boardMap = new Map(boards.map((b) => [b.id, b]));

    const summaries = await db
      .select()
      .from(sessionSummariesTable)
      .where(inArray(sessionSummariesTable.sessionId, childIds));
    const summaryMap = new Map(summaries.map((s) => [s.sessionId, s]));

    const childSessions = await db
      .select()
      .from(advisorySessionsTable)
      .where(inArray(advisorySessionsTable.id, childIds));
    const childSessionMap = new Map(childSessions.map((s) => [s.id, s]));

    // Build prompt.
    const childBlocks = opts.childSessions
      .map((c) => {
        const board = boardMap.get(c.boardId);
        const summary = summaryMap.get(c.sessionId);
        const session = childSessionMap.get(c.sessionId);
        const boardName = board?.name ?? "Unknown board";
        const status = session?.status ?? "unknown";
        return [
          `## BOARD: ${boardName} (id=${c.boardId}) — status=${status}`,
          summary?.chairsFraming
            ? `### Chair's framing\n${summary.chairsFraming}`
            : "",
          summary?.convergenceNote
            ? `### Convergence note\n${summary.convergenceNote}`
            : "",
          summary?.finalSummary
            ? `### Final summary\n${summary.finalSummary}`
            : "",
          summary?.openQuestionsText
            ? `### Open questions\n${summary.openQuestionsText}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      })
      .join("\n\n---\n\n");

    const synthUser = [
      "QUESTION",
      opts.question,
      "",
      "BOARDS CONSULTED",
      ...boards.map((b) => `- id=${b.id} name=${b.name}`),
      "",
      "PER-BOARD OUTPUTS",
      childBlocks,
      "",
      "TASK",
      "You are the Master synthesizer. Compare the boards. Identify topics where boards align, where they diverge, and what each board uniquely surfaced. Produce a meta-recommendation that integrates the strongest signal across boards.",
      "",
      "Return STRICT JSON inside a ```json fenced block:",
      `{
  "alignmentMatrix": [
    {
      "topic": "<short topic, e.g. 'Q3 timing risk'>",
      "verdicts": [
        { "boardId": "<id>", "boardName": "<name>", "stance": "<crisp 1-line stance>" }
      ]
    }
  ],
  "uniqueInsights": [
    { "boardId": "<id>", "boardName": "<name>", "insight": "<insight only this board surfaced>" }
  ],
  "metaRecommendation": "<one paragraph integrated recommendation>",
  "synthesisNarrative": "<2-4 paragraph narrative on where boards agreed, diverged, and the strongest collective signal>"
}`,
      "Return ONLY the JSON inside the fence. No commentary outside.",
    ].join("\n");

    emit(opts.crossExamId, {
      type: "synthesis",
      crossExamId: opts.crossExamId,
      payload: { phase: "started" },
    });

    const masterModel = MASTER_MODEL_DEFAULT;
    const systemPrompt =
      "You are the Master cross-examination synthesizer. You analyze how multiple boards of advisors responded to the same strategic question and produce a rigorous comparative synthesis.";

    const synth = await callClaude({
      model: masterModel,
      systemPrompt,
      userMessage: synthUser,
      maxTokens: 6000,
      logger: log,
    });

    if (synth.status !== "complete") {
      throw new Error(`Synthesis failed: ${synth.errorDetail}`);
    }

    const parsed = tryParseJson<SynthesisPayload>(synth.text) ?? {};
    const alignmentMatrix = parsed.alignmentMatrix ?? [];
    const uniqueInsights = parsed.uniqueInsights ?? [];
    const metaRecommendation = parsed.metaRecommendation ?? "";
    const synthesisNarrative = parsed.synthesisNarrative ?? synth.text;

    const synthCost = computeCostCents(
      masterModel,
      synth.inputTokens,
      synth.outputTokens,
    );

    const childCostTotal = childSessions.reduce(
      (s, c) => s + (c.totalCostCents ?? 0),
      0,
    );
    const totalCost = synthCost + childCostTotal;

    await db
      .update(crossExaminationsTable)
      .set({
        status: "complete",
        completedAt: new Date(),
        alignmentMatrixJson: JSON.stringify(alignmentMatrix),
        uniqueInsightsJson: JSON.stringify(uniqueInsights),
        metaRecommendation,
        synthesisNarrative,
        totalCostCents: totalCost,
      })
      .where(eq(crossExaminationsTable.id, opts.crossExamId));

    emit(opts.crossExamId, {
      type: "synthesis",
      crossExamId: opts.crossExamId,
      payload: {
        phase: "complete",
        alignmentMatrix,
        uniqueInsights,
        metaRecommendation,
        synthesisNarrative,
        totalCostCents: totalCost,
      },
    });
    emit(opts.crossExamId, {
      type: "complete",
      crossExamId: opts.crossExamId,
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    log.error({ err }, "Cross-examination failed");
    await db
      .update(crossExaminationsTable)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(crossExaminationsTable.id, opts.crossExamId));
    emit(opts.crossExamId, {
      type: "error",
      crossExamId: opts.crossExamId,
      payload: { error: e?.message ?? "unknown error" },
    });
  } finally {
    setTimeout(() => subscribers.delete(opts.crossExamId), 5_000);
  }
}

export async function loadCrossExaminationContributionCount(
  sessionIds: string[],
): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await db
    .select({
      sessionId: sessionContributionsTable.sessionId,
    })
    .from(sessionContributionsTable)
    .where(inArray(sessionContributionsTable.sessionId, sessionIds));
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.sessionId, (map.get(r.sessionId) ?? 0) + 1);
  }
  return map;
}
