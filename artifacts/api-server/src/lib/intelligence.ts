import {
  db,
  advisorySessionsTable,
  sessionContributionsTable,
  sessionSummariesTable,
  sessionTopicsTable,
  decisionsTable,
  decisionOutcomesTable,
  boardsTable,
  boardMembersTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { callClaude } from "./anthropic";
import { logger as rootLogger } from "./logger";

const log = rootLogger.child({ module: "intelligence" });

const TOPIC_MODEL = "claude-haiku-4-5";

function normalizeTopic(s: string): string {
  return s
    .trim()
    .replace(/^[-*•\d.\s)]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?"']+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

export async function extractAndStoreTopics(sessionId: string): Promise<string[]> {
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, sessionId))
    .limit(1);
  if (!session) return [];

  const [summary] = await db
    .select()
    .from(sessionSummariesTable)
    .where(eq(sessionSummariesTable.sessionId, sessionId))
    .limit(1);

  const userMessage = [
    "Tag the following advisory-board session with 1-3 short canonical topic labels.",
    "Topics should be lowercased noun phrases (e.g. 'pricing strategy', 'market entry', 'team hiring', 'fundraising').",
    "Return ONLY a comma-separated list of 1-3 topics. No explanation.",
    "",
    "QUESTION:",
    session.questionText.slice(0, 2000),
    summary?.convergenceNote
      ? `\nCONVERGENCE NOTE:\n${summary.convergenceNote.slice(0, 1500)}`
      : "",
  ].join("\n");

  let topics: string[] = [];
  try {
    const result = await callClaude({
      model: TOPIC_MODEL,
      systemPrompt:
        "You are a precise tagger. Output only a comma-separated list of 1-3 canonical noun-phrase topic tags. No prose.",
      userMessage,
      maxTokens: 80,
      temperature: 0.2,
      logger: log,
    });
    if (result.status === "complete" && result.text) {
      topics = result.text
        .split(/[,\n]/)
        .map(normalizeTopic)
        .filter((t) => t.length > 1 && t.length < 60)
        .slice(0, 3);
    }
  } catch (err) {
    log.warn({ err, sessionId }, "topic extraction failed");
  }

  if (topics.length === 0) {
    // Heuristic fallback: take prominent keywords.
    const fallback = session.questionText
      .toLowerCase()
      .split(/[^a-z0-9 ]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 4)
      .slice(0, 2);
    topics = Array.from(new Set(fallback)).slice(0, 2);
  }

  if (topics.length === 0) return [];

  await db
    .insert(sessionTopicsTable)
    .values(
      topics.map((t, i) => ({ sessionId, topic: t, ordering: i })),
    )
    .onConflictDoNothing();

  return topics;
}

interface SparkPoint {
  weekStart: string;
  count: number;
}

function buildVelocity(rows: { startedAt: Date }[], weeks: number): SparkPoint[] {
  const now = new Date();
  const buckets: SparkPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    d.setUTCHours(0, 0, 0, 0);
    // align to Monday
    const day = d.getUTCDay();
    const offset = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
    buckets.push({ weekStart: d.toISOString().slice(0, 10), count: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const r of rows) {
    const d = new Date(r.startedAt);
    d.setUTCHours(0, 0, 0, 0);
    const day = d.getUTCDay();
    const offset = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
    const k = d.toISOString().slice(0, 10);
    const i = idx.get(k);
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

export async function getTenantIntelligence(tenantId: string) {
  const sessions = await db
    .select({
      id: advisorySessionsTable.id,
      boardId: advisorySessionsTable.boardId,
      mode: advisorySessionsTable.mode,
      startedAt: advisorySessionsTable.startedAt,
      status: advisorySessionsTable.status,
    })
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.tenantId, tenantId));

  const decisions = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.tenantId, tenantId));

  const decisionIds = decisions.map((d) => d.id);
  const outcomes = decisionIds.length
    ? await db
        .select()
        .from(decisionOutcomesTable)
        .where(inArray(decisionOutcomesTable.decisionId, decisionIds))
    : [];
  const outcomeByDecision = new Map(outcomes.map((o) => [o.decisionId, o]));

  // Win-rate by tag
  const tagCounts: Record<string, number> = {
    WIN: 0,
    LOSS: 0,
    MIXED: 0,
    TOO_EARLY: 0,
  };
  for (const o of outcomes) {
    tagCounts[o.tag] = (tagCounts[o.tag] ?? 0) + 1;
  }
  const recordedOutcomes = outcomes.length;
  const winRate = recordedOutcomes
    ? tagCounts.WIN / recordedOutcomes
    : 0;

  // Velocity (sessions per week, last 12 weeks)
  const velocity = buildVelocity(sessions, 12);
  const decisionVelocity = buildVelocity(
    decisions.map((d) => ({ startedAt: d.decidedAt })),
    12,
  );

  // Top trending topics
  const sessionIdsList = sessions.map((s) => s.id);
  const topics = sessionIdsList.length
    ? await db
        .select()
        .from(sessionTopicsTable)
        .where(inArray(sessionTopicsTable.sessionId, sessionIdsList))
    : [];
  const topicCounts = new Map<string, number>();
  for (const t of topics) {
    topicCounts.set(t.topic, (topicCounts.get(t.topic) ?? 0) + 1);
  }
  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([topic, count]) => ({ topic, count }));

  // Untagged session count (for backfill UX)
  const taggedSessionIds = new Set(topics.map((t) => t.sessionId));
  const untaggedCount = sessions.filter(
    (s) => s.status === "complete" && !taggedSessionIds.has(s.id),
  ).length;

  const decisionsResolved = decisions.filter(
    (d) => d.status !== "PENDING" || outcomeByDecision.has(d.id),
  ).length;

  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s) => s.status === "complete").length,
    totalDecisions: decisions.length,
    decisionsResolved,
    recordedOutcomes,
    winRate,
    tagCounts,
    velocity,
    decisionVelocity,
    topTopics,
    untaggedSessionCount: untaggedCount,
  };
}

export async function getBoardIntelligence(boardId: string) {
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) return null;

  const members = await db
    .select()
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, boardId));

  const sessions = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.boardId, boardId))
    .orderBy(desc(advisorySessionsTable.startedAt));

  const sessionIds = sessions.map((s) => s.id);
  const contributions = sessionIds.length
    ? await db
        .select()
        .from(sessionContributionsTable)
        .where(inArray(sessionContributionsTable.sessionId, sessionIds))
    : [];

  // Per-advisor stats
  const perAdvisor = members.map((m) => {
    const mine = contributions.filter((c) => c.boardMemberId === m.id);
    const wordCounts = mine
      .map((c) => (c.contributionText ?? "").split(/\s+/).filter(Boolean).length)
      .filter((n) => n > 0);
    const avgWords = wordCounts.length
      ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
      : 0;
    const votes = mine.filter((c) => c.vote);
    const yes = votes.filter((c) => c.vote === "YES").length;
    const no = votes.filter((c) => c.vote === "NO").length;
    const abstain = votes.filter((c) => c.vote === "ABSTAIN").length;

    // Confidence trend: recent 8 sessions, avg word count per session
    const ordered = [...mine].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const recent = ordered.slice(-8);
    const trend = recent.map((c) => ({
      sessionId: c.sessionId,
      words: (c.contributionText ?? "").split(/\s+/).filter(Boolean).length,
    }));

    return {
      memberId: m.id,
      name: m.name,
      roleTitle: m.roleTitle,
      lensDescription: m.lensDescription ?? null,
      contributionCount: mine.length,
      avgWords,
      voteYes: yes,
      voteNo: no,
      voteAbstain: abstain,
      trend,
    };
  });

  // Dissent leaderboard: count sessions where advisor was the lone dissenter
  // OR voted against the majority outcome.
  const dissentByMember = new Map<string, number>();
  const sessionsWithVotes = sessionIds.filter((sid) => {
    const votes = contributions.filter((c) => c.sessionId === sid && c.vote);
    return votes.length >= 2;
  });

  for (const sid of sessionsWithVotes) {
    const votes = contributions.filter((c) => c.sessionId === sid && c.vote);
    const tally = { YES: 0, NO: 0, ABSTAIN: 0 } as Record<string, number>;
    for (const v of votes) tally[v.vote as string]++;
    const winner = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0] ?? [
      "",
    ])[0];
    for (const v of votes) {
      if (v.vote !== winner && v.boardMemberId) {
        dissentByMember.set(
          v.boardMemberId,
          (dissentByMember.get(v.boardMemberId) ?? 0) + 1,
        );
      }
    }
  }
  const dissentLeaders = Array.from(dissentByMember.entries())
    .map(([memberId, count]) => {
      const m = members.find((x) => x.id === memberId);
      return {
        memberId,
        name: m?.name ?? "Unknown",
        roleTitle: m?.roleTitle ?? "",
        dissentCount: count,
      };
    })
    .sort((a, b) => b.dissentCount - a.dissentCount)
    .slice(0, 5);

  // Unanimity rate
  let unanimous = 0;
  let voted = 0;
  for (const sid of sessionsWithVotes) {
    const votes = contributions.filter((c) => c.sessionId === sid && c.vote);
    if (votes.length < 2) continue;
    voted++;
    const set = new Set(votes.map((v) => v.vote));
    if (set.size === 1) unanimous++;
  }
  const unanimityRate = voted ? unanimous / voted : 0;

  // Average words per advisor across the whole board
  const allWordCounts = contributions
    .map((c) => (c.contributionText ?? "").split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0);
  const overallAvgWords = allWordCounts.length
    ? Math.round(allWordCounts.reduce((a, b) => a + b, 0) / allWordCounts.length)
    : 0;

  // Longest / shortest deliberators by avg words
  const sortedByWords = [...perAdvisor]
    .filter((a) => a.contributionCount > 0)
    .sort((a, b) => b.avgWords - a.avgWords);
  const longestDeliberator = sortedByWords[0] ?? null;
  const shortestDeliberator = sortedByWords[sortedByWords.length - 1] ?? null;

  // Vote-flip rate: not perfectly knowable without opening positions, so we
  // approximate using BOARD-mode sessions and check whether the resulting
  // decision recommendation tone (recommendationText present + majority vote)
  // matches the majority of votes. If majority is YES but decision was
  // declined/overridden, count as flip.
  const decisions = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.boardId, boardId));
  let flips = 0;
  for (const d of decisions) {
    const total = d.voteYes + d.voteNo + d.voteAbstain;
    if (total === 0) continue;
    const yesMajority = d.voteYes > d.voteNo;
    const acted = d.status === "ACTED";
    const declined = d.status === "DECLINED" || d.status === "OVERRIDDEN";
    if (yesMajority && declined) flips++;
    else if (!yesMajority && acted) flips++;
  }
  const voteFlipRate = decisions.length ? flips / decisions.length : 0;

  // Anomaly: advisors whose vote alignment is far from majority
  const anomalousMembers = perAdvisor
    .filter((a) => {
      const votesTotal = a.voteYes + a.voteNo + a.voteAbstain;
      if (votesTotal < 3) return false;
      const dissent = dissentByMember.get(a.memberId) ?? 0;
      return dissent / Math.max(votesTotal, 1) >= 0.5;
    })
    .map((a) => a.memberId);

  return {
    boardId: board.id,
    boardName: board.name,
    sessionCount: sessions.length,
    completedCount: sessions.filter((s) => s.status === "complete").length,
    unanimityRate,
    voteFlipRate,
    overallAvgWords,
    perAdvisor,
    dissentLeaders,
    longestDeliberatorMemberId: longestDeliberator?.memberId ?? null,
    shortestDeliberatorMemberId: shortestDeliberator?.memberId ?? null,
    anomalousMemberIds: anomalousMembers,
  };
}

export async function backfillTopicsForTenant(
  tenantId: string,
  limit: number,
): Promise<{ processed: number; remaining: number }> {
  const tagged = db
    .select({ sid: sessionTopicsTable.sessionId })
    .from(sessionTopicsTable);
  const candidates = await db
    .select({ id: advisorySessionsTable.id })
    .from(advisorySessionsTable)
    .where(
      and(
        eq(advisorySessionsTable.tenantId, tenantId),
        eq(advisorySessionsTable.status, "complete"),
        sql`${advisorySessionsTable.id} NOT IN ${tagged}`,
      ),
    )
    .orderBy(desc(advisorySessionsTable.startedAt))
    .limit(limit);

  for (const s of candidates) {
    await extractAndStoreTopics(s.id);
  }

  const remainingRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(advisorySessionsTable)
    .where(
      and(
        eq(advisorySessionsTable.tenantId, tenantId),
        eq(advisorySessionsTable.status, "complete"),
        sql`${advisorySessionsTable.id} NOT IN ${tagged}`,
      ),
    );

  return {
    processed: candidates.length,
    remaining: Number(remainingRows[0]?.c ?? 0) - candidates.length,
  };
}
