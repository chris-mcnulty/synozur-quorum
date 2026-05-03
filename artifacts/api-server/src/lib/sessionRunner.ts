import {
  db,
  advisorySessionsTable,
  sessionContributionsTable,
  sessionSummariesTable,
  boardsTable,
  boardMembersTable,
  groundingDocumentsTable,
  groundingSelectorsTable,
  sessionGroundingSnapshotsTable,
  decisionsTable,
  type Board,
  type BoardMember,
  type GroundingSelector,
} from "@workspace/db";
import { eq, or, isNull } from "drizzle-orm";
import { fetchSnapshot, providerDisplay } from "./grounding";
import type { GroundingProvider } from "./grounding";
import { loadResolvedDecisionsForBoard } from "./decisions";
import {
  callClaude,
  computeCostCents,
  MASTER_MODEL_DEFAULT,
  MEMBER_MODEL_DEFAULT,
} from "./anthropic";
import { logger as rootLogger } from "./logger";

export type SessionMode = "ADVISORY" | "BOARD" | "REVIEW";
export type Vote = "YES" | "NO" | "ABSTAIN";

export interface ProgressEvent {
  type:
    | "started"
    | "framing"
    | "member_started"
    | "member_done"
    | "convergence"
    | "complete"
    | "error"
    | "comment_added"
    | "reaction_added"
    | "reaction_removed"
    | "follow_up_added"
    | "follow_up_dispatched"
    | "presence";
  sessionId: string;
  payload?: unknown;
}

type Subscriber = (e: ProgressEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribeToSession(
  sessionId: string,
  cb: Subscriber,
): () => void {
  let set = subscribers.get(sessionId);
  if (!set) {
    set = new Set();
    subscribers.set(sessionId, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) subscribers.delete(sessionId);
  };
}

function emit(sessionId: string, event: ProgressEvent) {
  const set = subscribers.get(sessionId);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(event);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function emitToSession(sessionId: string, event: ProgressEvent): void {
  emit(sessionId, event);
}

interface FramingPayload {
  framing: string;
  facts: string;
  routedMemberIds: string[];
}

function parseVoteLine(text: string): { vote: Vote | null; rationale: string | null } {
  const m = text.match(/VOTE:\s*(YES|NO|ABSTAIN)\s*[—\-:]\s*(.+?)\s*$/im);
  if (!m) {
    const m2 = text.match(/VOTE:\s*(YES|NO|ABSTAIN)/i);
    if (m2) return { vote: m2[1].toUpperCase() as Vote, rationale: null };
    return { vote: null, rationale: null };
  }
  return { vote: m[1].toUpperCase() as Vote, rationale: m[2].trim() };
}

function tryParseJson<T = unknown>(s: string): T | null {
  // Try to find a JSON block inside fenced code or raw
  const fence = s.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : s;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // try greedy {...}
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

interface PersistedSnapshot {
  selectorId: string;
  boardMemberId: string | null;
  provider: GroundingProvider;
  selectorName: string;
  contentText: string;
  tokenEstimate: number;
  truncated: boolean;
  fetchStatus: string;
}

async function fetchAndPersistSnapshots(
  sessionId: string,
  boardId: string,
  memberIds: string[],
): Promise<PersistedSnapshot[]> {
  const selectors: GroundingSelector[] = await db
    .select()
    .from(groundingSelectorsTable)
    .where(
      or(
        eq(groundingSelectorsTable.boardId, boardId),
        memberIds.length > 0
          ? eq(groundingSelectorsTable.boardMemberId, memberIds[0])
          : isNull(groundingSelectorsTable.boardMemberId),
      ),
    );
  // Drizzle's `or` with parametrized eq cannot easily express IN; refilter in memory:
  const memberIdSet = new Set(memberIds);
  const relevant = selectors.filter(
    (s) =>
      s.boardId === boardId ||
      (s.boardMemberId && memberIdSet.has(s.boardMemberId)),
  );

  const out: PersistedSnapshot[] = [];
  for (const sel of relevant) {
    const provider = sel.provider as GroundingProvider;
    const result = await fetchSnapshot({
      provider,
      query: (sel.queryJson ?? {}) as Record<string, unknown>,
      tokenBudget: sel.tokenBudget,
    });
    const [persisted] = await db
      .insert(sessionGroundingSnapshotsTable)
      .values({
        sessionId,
        selectorId: sel.id,
        boardMemberId: sel.boardMemberId,
        provider,
        selectorName: sel.name,
        queryJson: sel.queryJson as Record<string, unknown>,
        contentText: result.contentText,
        tokenEstimate: result.tokenEstimate,
        truncated: result.truncated,
        fetchStatus: result.status,
        errorDetail: result.errorDetail ?? null,
      })
      .returning();
    out.push({
      selectorId: sel.id,
      boardMemberId: sel.boardMemberId,
      provider,
      selectorName: sel.name,
      contentText: result.contentText,
      tokenEstimate: result.tokenEstimate,
      truncated: result.truncated,
      fetchStatus: persisted.fetchStatus,
    });
  }
  return out;
}

function renderSnapshotsForPrompt(snaps: PersistedSnapshot[]): string {
  if (snaps.length === 0) return "";
  const blocks = snaps.map((s) => {
    const header = `=== LIVE GROUNDING — ${providerDisplay(s.provider)}: ${s.selectorName} (${s.tokenEstimate} tok${s.truncated ? ", truncated" : ""}, status=${s.fetchStatus}) ===`;
    return `${header}\n${s.contentText || "(no content)"}\n=== END ${providerDisplay(s.provider)}: ${s.selectorName} ===`;
  });
  return `\n\n${blocks.join("\n\n")}`;
}

async function loadGrounding(memberId: string): Promise<string> {
  const [m] = await db
    .select()
    .from(boardMembersTable)
    .where(eq(boardMembersTable.id, memberId))
    .limit(1);
  if (!m?.groundingDocumentId) return "";
  const [doc] = await db
    .select()
    .from(groundingDocumentsTable)
    .where(eq(groundingDocumentsTable.id, m.groundingDocumentId))
    .limit(1);
  return doc?.extractedText ?? "";
}

function memberSystemPrompt(
  member: BoardMember,
  groundingText: string,
  liveGroundingText: string,
): string {
  let prompt = member.instructionsText;
  if (groundingText.trim().length > 0) {
    prompt += `\n\n=== GROUNDING DOCUMENT (read-only context) ===\n${groundingText}\n=== END GROUNDING ===`;
  }
  if (liveGroundingText.trim().length > 0) {
    prompt += liveGroundingText;
  }
  return prompt;
}

function memberUserMessage(
  mode: SessionMode,
  facts: string,
  question: string,
  isVote: boolean,
  branchNote?: string | null,
): string {
  return [
    `MODE: ${mode}${isVote ? " (vote required)" : ""}`,
    "",
    branchNote
      ? `BRANCH CONDITION (what changed since the prior session): ${branchNote}\n`
      : "",
    "ESTABLISHED FACTS",
    facts || "(none recorded)",
    "",
    "QUESTION",
    question,
    "",
    isVote
      ? "Respond in your own voice with your analysis, then end with exactly one line:\nVOTE: YES | NO | ABSTAIN — <one-sentence rationale>"
      : "Respond in your own voice. Do not synthesize across other members.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

interface RunOptions {
  sessionId: string;
  tenantId: string;
  boardId: string;
  mode: SessionMode;
  question: string;
  allHands: boolean;
  branchContext?: {
    parentQuestion: string;
    parentFinalSummary: string | null;
    parentConvergenceNote: string | null;
    branchNote: string;
  };
  includeResolvedDecisions?: boolean;
}

function formatPriorDecisions(
  rows: Array<{
    questionText: string;
    recommendationText: string | null;
    status: string;
    voteYes: number;
    voteNo: number;
    voteAbstain: number;
    outcome: { tag: string; noteText: string | null } | null;
    decidedAt: Date;
  }>,
): string {
  if (!rows.length) return "";
  const lines = rows.map((r, i) => {
    const tally = `Y${r.voteYes}/N${r.voteNo}/A${r.voteAbstain}`;
    const outcome = r.outcome
      ? `${r.outcome.tag}${r.outcome.noteText ? ` — ${r.outcome.noteText}` : ""}`
      : "no outcome recorded";
    const rec = r.recommendationText
      ? r.recommendationText.slice(0, 400)
      : "(no recommendation captured)";
    return `${i + 1}. [${r.decidedAt.toISOString().slice(0, 10)}] Q: ${r.questionText}\n   Recommendation: ${rec}\n   Vote: ${tally} · Status: ${r.status} · Outcome: ${outcome}`;
  });
  return [
    "=== PRIOR RESOLVED DECISIONS (institutional memory) ===",
    "Use these as context for compounding judgment, but do not be bound by them.",
    ...lines,
    "=== END PRIOR DECISIONS ===",
  ].join("\n");
}

export async function runSession(opts: RunOptions): Promise<void> {
  const log = rootLogger.child({ sessionId: opts.sessionId });
  emit(opts.sessionId, { type: "started", sessionId: opts.sessionId });

  try {
    const [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, opts.boardId))
      .limit(1);
    if (!board) throw new Error("Board not found");

    const members = await db
      .select()
      .from(boardMembersTable)
      .where(eq(boardMembersTable.boardId, board.id))
      .orderBy(boardMembersTable.ordering);
    if (members.length === 0) throw new Error("Board has no members");

    // Phase 0: fetch live grounding snapshots from connected sources
    const snapshots = await fetchAndPersistSnapshots(
      opts.sessionId,
      board.id,
      members.map((m) => m.id),
    );
    const boardSnapshots = snapshots.filter((s) => s.boardMemberId === null);
    const memberSnapshotsByMember = new Map<string, PersistedSnapshot[]>();
    for (const s of snapshots) {
      if (s.boardMemberId) {
        const list = memberSnapshotsByMember.get(s.boardMemberId) ?? [];
        list.push(s);
        memberSnapshotsByMember.set(s.boardMemberId, list);
      }
    }
    const boardLiveText = renderSnapshotsForPrompt(boardSnapshots);

    // Hard-pin master model per spec — board.defaultMasterModel overrides are ignored.
    const masterModel = MASTER_MODEL_DEFAULT;
    const temperature = Number(board.temperature);

    // Phase 1: framing + routing from master
    const roster = members
      .map(
        (m, i) =>
          `${i + 1}. id=${m.id} | ${m.name}, ${m.roleTitle}${
            m.lensDescription ? ` — ${m.lensDescription}` : ""
          }`,
      )
      .join("\n");

    const allHandsRequired = opts.mode === "BOARD" || opts.allHands;

    const branchBlock = opts.branchContext
      ? [
          "PARENT SESSION CONTEXT (this is a branched what-if rerun)",
          `Original question: ${opts.branchContext.parentQuestion}`,
          opts.branchContext.parentFinalSummary
            ? `Parent final summary: ${opts.branchContext.parentFinalSummary}`
            : "",
          opts.branchContext.parentConvergenceNote
            ? `Parent convergence note: ${opts.branchContext.parentConvergenceNote}`
            : "",
          `Variable changed for this branch: ${opts.branchContext.branchNote}`,
          "Please weigh how the change affects the council's reasoning relative to the parent session.",
          "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const priorDecisionsBlock = opts.includeResolvedDecisions
      ? formatPriorDecisions(await loadResolvedDecisionsForBoard(board.id, 5))
      : "";

    const framingUser = [
      `MODE: ${opts.mode}`,
      `ALL_HANDS_REQUIRED: ${allHandsRequired}`,
      "",
      branchBlock,
      "BOARD ROSTER",
      roster,
      "",
      ...(priorDecisionsBlock ? [priorDecisionsBlock, ""] : []),
      "QUESTION",
      opts.question,
      "",
      "TASK",
      "Produce the chair's framing and established facts. Then return STRICT JSON",
      "of the form:",
      `{"framing": "<chair's framing prose>", "facts": "<established facts as bullet list with leading -", "routedMemberIds": ["<id>", ...]}`,
      allHandsRequired
        ? "Because ALL_HANDS_REQUIRED is true, routedMemberIds MUST contain every member id."
        : "Choose 3-5 routed member ids relevant to the question, plus one explicit dissent slot member id.",
      "Return ONLY the JSON inside a ```json fenced block. No commentary outside the fence.",
    ].join("\n");

    const masterSystem = board.masterInstructionsText + boardLiveText;
    const framingResult = await callClaude({
      model: masterModel,
      systemPrompt: masterSystem,
      userMessage: framingUser,
      maxTokens: 4000,
      temperature,
      logger: log,
    });

    if (framingResult.status !== "complete") {
      throw new Error(`Master framing failed: ${framingResult.errorDetail}`);
    }

    const parsed = tryParseJson<FramingPayload>(framingResult.text);
    let framing = parsed?.framing ?? framingResult.text;
    let facts = parsed?.facts ?? "";
    let routedIds: string[] = parsed?.routedMemberIds ?? [];
    if (allHandsRequired || routedIds.length === 0) {
      routedIds = members.map((m) => m.id);
    }

    // Persist facts on session row
    await db
      .update(advisorySessionsTable)
      .set({ establishedFactsText: facts })
      .where(eq(advisorySessionsTable.id, opts.sessionId));

    // Persist a chair's framing contribution row
    const masterCost1 = computeCostCents(
      masterModel,
      framingResult.inputTokens,
      framingResult.outputTokens,
    );

    emit(opts.sessionId, {
      type: "framing",
      sessionId: opts.sessionId,
      payload: { framing, facts, routedMemberIds: routedIds },
    });

    // Phase 2: invoke routed members in parallel
    const routedMembers = members.filter((m) => routedIds.includes(m.id));
    const isVoteMode = opts.mode === "BOARD";

    const memberResults = await Promise.all(
      routedMembers.map(async (m) => {
        emit(opts.sessionId, {
          type: "member_started",
          sessionId: opts.sessionId,
          payload: {
            memberId: m.id,
            name: m.name,
            roleTitle: m.roleTitle,
          },
        });
        const grounding = await loadGrounding(m.id);
        const memberLive = renderSnapshotsForPrompt([
          ...boardSnapshots,
          ...(memberSnapshotsByMember.get(m.id) ?? []),
        ]);
        const result = await callClaude({
          model:
            MEMBER_MODEL_DEFAULT,
          systemPrompt: memberSystemPrompt(m, grounding, memberLive),
          userMessage: memberUserMessage(
            opts.mode,
            facts,
            opts.question,
            isVoteMode,
            opts.branchContext?.branchNote ?? null,
          ),
          maxTokens: 2000,
          temperature,
          logger: log,
        });

        const { vote, rationale } = isVoteMode
          ? parseVoteLine(result.text)
          : { vote: null, rationale: null };

        const [row] = await db
          .insert(sessionContributionsTable)
          .values({
            sessionId: opts.sessionId,
            boardMemberId: m.id,
            memberName: m.name,
            memberRoleTitle: m.roleTitle,
            contributionText: result.text,
            vote,
            voteRationale: rationale,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs: result.latencyMs,
            status: result.status,
            errorDetail: result.errorDetail ?? null,
          })
          .returning();

        emit(opts.sessionId, {
          type: "member_done",
          sessionId: opts.sessionId,
          payload: {
            contribution: row,
          },
        });

        const cost = computeCostCents(
          m.modelOverride || board.defaultMemberModel || MEMBER_MODEL_DEFAULT,
          result.inputTokens,
          result.outputTokens,
        );

        return { member: m, result, vote, rationale, cost, contributionId: row.id };
      }),
    );

    // Phase 3: master synthesizes convergence
    const summaryUser = [
      `MODE: ${opts.mode}`,
      "",
      "ESTABLISHED FACTS",
      facts,
      "",
      "QUESTION",
      opts.question,
      "",
      "MEMBER CONTRIBUTIONS",
      ...memberResults.map((r) => {
        if (r.result.status !== "complete") {
          return `\n## ${r.member.name}, ${r.member.roleTitle}\n[${r.result.status.toUpperCase()}: ${r.result.errorDetail ?? "no contribution"}]`;
        }
        return `\n## ${r.member.name}, ${r.member.roleTitle}\n${r.result.text}`;
      }),
      "",
      "TASK",
      `Produce the synthesis. Return STRICT JSON inside a fenced \`\`\`json block:
{
  "convergenceNote": "<crisp narrative of where members agreed/disagreed, with persona attribution headers in markdown like **Name, Role**>",
  "openQuestions": "<bulleted list of open questions raised by the board>",
  "flagsRaised": "<bulleted list of failures, refusals, timeouts, or boundary violations encountered>",
  "voteTable": ${isVoteMode ? "[{ \"name\": \"...\", \"roleTitle\": \"...\", \"vote\": \"YES|NO|ABSTAIN\", \"rationale\": \"...\" }]" : "null"},
  "finalSummary": "<one-paragraph executive summary>"
}`,
    ].join("\n");

    const synth = await callClaude({
      model: masterModel,
      systemPrompt: masterSystem,
      userMessage: summaryUser,
      maxTokens: 4000,
      temperature,
      logger: log,
    });

    interface SynthPayload {
      convergenceNote?: string;
      openQuestions?: string;
      flagsRaised?: string;
      voteTable?: Array<{
        name: string;
        roleTitle: string;
        vote: string;
        rationale: string;
      }> | null;
      finalSummary?: string;
    }
    const synthJson = tryParseJson<SynthPayload>(synth.text) ?? {};
    const convergenceNote = synthJson.convergenceNote ?? synth.text;
    const openQuestions = synthJson.openQuestions ?? "";
    const flagsRaised = synthJson.flagsRaised ?? "";
    const finalSummary = synthJson.finalSummary ?? "";

    const masterCost2 = computeCostCents(
      masterModel,
      synth.inputTokens,
      synth.outputTokens,
    );

    const memberCostTotal = memberResults.reduce((s, r) => s + r.cost, 0);
    const totalCost = masterCost1 + masterCost2 + memberCostTotal;

    await db.insert(sessionSummariesTable).values({
      sessionId: opts.sessionId,
      chairsFraming: framing,
      convergenceNote,
      openQuestionsText: openQuestions,
      finalSummary,
      flagsRaisedText: flagsRaised,
      totalCostCents: totalCost,
    });

    await db
      .update(advisorySessionsTable)
      .set({
        status: "complete",
        completedAt: new Date(),
        totalCostCents: totalCost,
      })
      .where(eq(advisorySessionsTable.id, opts.sessionId));

    // Auto-link: BOARD-mode sessions become tracked decisions
    if (opts.mode === "BOARD") {
      try {
        const tally = memberResults.reduce(
          (acc, r) => {
            if (r.vote === "YES") acc.yes++;
            else if (r.vote === "NO") acc.no++;
            else if (r.vote === "ABSTAIN") acc.abstain++;
            return acc;
          },
          { yes: 0, no: 0, abstain: 0 },
        );
        const recommendation =
          [convergenceNote, finalSummary].filter((s) => s && s.trim()).join("\n\n") ||
          null;
        await db
          .insert(decisionsTable)
          .values({
            tenantId: opts.tenantId,
            boardId: opts.boardId,
            sessionId: opts.sessionId,
            questionText: opts.question,
            recommendationText: recommendation,
            voteYes: tally.yes,
            voteNo: tally.no,
            voteAbstain: tally.abstain,
            status: "PENDING",
          })
          .onConflictDoNothing({ target: decisionsTable.sessionId });
      } catch (err) {
        log.error({ err }, "Failed to auto-link decision");
      }
    }

    emit(opts.sessionId, {
      type: "convergence",
      sessionId: opts.sessionId,
      payload: {
        convergenceNote,
        openQuestions,
        flagsRaised,
        finalSummary,
        totalCostCents: totalCost,
      },
    });
    emit(opts.sessionId, { type: "complete", sessionId: opts.sessionId });
  } catch (err: unknown) {
    const e = err as { message?: string };
    log.error({ err }, "Session run failed");
    await db
      .update(advisorySessionsTable)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(advisorySessionsTable.id, opts.sessionId));
    emit(opts.sessionId, {
      type: "error",
      sessionId: opts.sessionId,
      payload: { error: e?.message ?? "unknown error" },
    });
  } finally {
    // Let any final subscribers receive the last events, then drop.
    setTimeout(() => subscribers.delete(opts.sessionId), 5_000);
  }
}

export interface BoardWithMembers {
  board: Board;
  members: BoardMember[];
}
