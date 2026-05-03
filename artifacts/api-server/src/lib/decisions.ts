import { eq, desc } from "drizzle-orm";
import { db, decisionsTable, decisionOutcomesTable } from "@workspace/db";

export type ResolvedDecisionForRunner = {
  questionText: string;
  recommendationText: string | null;
  status: string;
  voteYes: number;
  voteNo: number;
  voteAbstain: number;
  outcome: { tag: string; noteText: string | null } | null;
  decidedAt: Date;
};

// Fetch the last N resolved decisions for a board (status != PENDING or has
// an outcome recorded). Used by the session runner to inject institutional
// memory into the chair's framing prompt.
export async function loadResolvedDecisionsForBoard(
  boardId: string,
  limit = 5,
): Promise<ResolvedDecisionForRunner[]> {
  const rows = await db
    .select({ d: decisionsTable, o: decisionOutcomesTable })
    .from(decisionsTable)
    .leftJoin(
      decisionOutcomesTable,
      eq(decisionOutcomesTable.decisionId, decisionsTable.id),
    )
    .where(eq(decisionsTable.boardId, boardId))
    .orderBy(desc(decisionsTable.decidedAt))
    .limit(50);

  const resolved = rows.filter(
    (r) => r.d.status !== "PENDING" || r.o !== null,
  );
  return resolved.slice(0, limit).map((r) => ({
    questionText: r.d.questionText,
    recommendationText: r.d.recommendationText,
    status: r.d.status,
    voteYes: r.d.voteYes,
    voteNo: r.d.voteNo,
    voteAbstain: r.d.voteAbstain,
    outcome: r.o ? { tag: r.o.tag, noteText: r.o.noteText } : null,
    decidedAt: r.d.decidedAt,
  }));
}
