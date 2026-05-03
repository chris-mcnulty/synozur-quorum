import {
  db,
  advisorySessionsTable,
  sessionContributionsTable,
  sessionSummariesTable,
  boardsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getMemoSections,
  type MemoSection,
  type SessionMemo,
} from "@workspace/api-zod";

type SessionStatus = typeof advisorySessionsTable.$inferSelect.status;

export type MemoVote = {
  memberName: string | null;
  memberRoleTitle: string | null;
  vote: "YES" | "NO" | "ABSTAIN" | null;
  voteRationale: string | null;
  contributionText: string | null;
};

export type MemoData = SessionMemo & {
  // Internal fields, not serialized externally.
  tenantId: string;
  boardId: string;
  status: SessionStatus;
  // Source rationales used to derive keyDissent — kept internal.
  voteSources: MemoVote[];
};

function firstParagraph(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf("\n\n");
  return idx === -1 ? trimmed : trimmed.slice(0, idx);
}

function pickKeyDissent(votes: MemoVote[]): string | null {
  const noVotes = votes.filter((v) => v.vote === "NO");
  if (noVotes.length === 0) return null;
  const first = noVotes[0]!;
  const rationale = first.voteRationale || firstParagraph(first.contributionText);
  if (!rationale) return null;
  const who = [first.memberName, first.memberRoleTitle].filter(Boolean).join(", ");
  return who ? `${who}: ${rationale}` : rationale;
}

export async function loadMemoData(sessionId: string): Promise<MemoData | null> {
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, sessionId))
    .limit(1);
  if (!session) return null;

  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, session.boardId))
    .limit(1);

  const contribs = await db
    .select()
    .from(sessionContributionsTable)
    .where(eq(sessionContributionsTable.sessionId, sessionId))
    .orderBy(sessionContributionsTable.createdAt);

  const [summary] = await db
    .select()
    .from(sessionSummariesTable)
    .where(eq(sessionSummariesTable.sessionId, sessionId))
    .limit(1);

  const voteSources: MemoVote[] = contribs.map((c) => ({
    memberName: c.memberName,
    memberRoleTitle: c.memberRoleTitle,
    vote: (c.vote as MemoVote["vote"]) ?? null,
    voteRationale: c.voteRationale,
    contributionText: c.contributionText,
  }));

  const tally = {
    yes: voteSources.filter((v) => v.vote === "YES").length,
    no: voteSources.filter((v) => v.vote === "NO").length,
    abstain: voteSources.filter((v) => v.vote === "ABSTAIN").length,
  };

  const recommendation =
    firstParagraph(summary?.convergenceNote ?? null) ||
    firstParagraph(summary?.finalSummary ?? null);

  return {
    sessionId: session.id,
    tenantId: session.tenantId,
    boardId: session.boardId,
    status: session.status,
    boardName: board?.name ?? "Board",
    questionText: session.questionText,
    recommendation,
    convergenceNote: summary?.convergenceNote ?? null,
    chairsFraming: summary?.chairsFraming ?? null,
    openQuestionsText: summary?.openQuestionsText ?? null,
    flagsRaisedText: summary?.flagsRaisedText ?? null,
    keyDissent: pickKeyDissent(voteSources),
    mode: session.mode as MemoData["mode"],
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    voteTally: tally,
    votes: voteSources.map(({ contributionText: _c, voteRationale: _r, ...v }) => v),
    voteSources,
  };
}

export function serializeMemo(memo: MemoData): SessionMemo {
  const { tenantId: _t, boardId: _b, status: _s, voteSources: _v, ...rest } = memo;
  return {
    ...rest,
    startedAt:
      rest.startedAt instanceof Date
        ? (rest.startedAt.toISOString() as unknown as Date)
        : rest.startedAt,
    completedAt:
      rest.completedAt instanceof Date
        ? (rest.completedAt.toISOString() as unknown as Date)
        : rest.completedAt,
  };
}

export function memoSectionsFor(memo: MemoData): MemoSection[] {
  return getMemoSections(serializeMemo(memo));
}

// ---- Markdown renderer (drives clipboard copy + .md endpoint) -------------

export function renderMemoMarkdown(memo: MemoData, opts?: { deepLink?: string }): string {
  const sections = memoSectionsFor(memo);
  const lines: string[] = [];

  for (const s of sections) {
    switch (s.kind) {
      case "header":
        lines.push(`# ${s.boardName} — Board memo`);
        lines.push("");
        lines.push(`> ${s.questionText.replace(/\n+/g, " ")}`);
        lines.push("");
        break;
      case "text":
        lines.push(`## ${s.label}`);
        lines.push(s.body.trim());
        lines.push("");
        break;
      case "voteTally":
        lines.push(`## Vote tally`);
        lines.push(`**Yes:** ${s.yes}  ·  **No:** ${s.no}  ·  **Abstain:** ${s.abstain}`);
        lines.push("");
        for (const v of s.votes) {
          const who = `${v.memberName ?? "Advisor"}${
            v.memberRoleTitle ? ` (${v.memberRoleTitle})` : ""
          }`;
          lines.push(`- ${who} — **${v.vote ?? "—"}**`);
        }
        lines.push("");
        break;
      case "footer":
        lines.push("---");
        lines.push(`_Signed by the ${s.boardName} · ${s.date}_`);
        if (opts?.deepLink) {
          lines.push("");
          lines.push(`[Open in Quorum](${opts.deepLink})`);
        }
        break;
    }
  }
  return lines.join("\n");
}

// Slack uses mrkdwn (subset of markdown). Built from sections so it stays in sync.
export function renderMemoSlackText(memo: MemoData, deepLink?: string): string {
  const sections = memoSectionsFor(memo);
  const lines: string[] = [];

  for (const s of sections) {
    switch (s.kind) {
      case "header":
        lines.push(`*${s.boardName} — Board memo*`);
        lines.push(`> ${s.questionText.replace(/\n+/g, " ")}`);
        break;
      case "text":
        lines.push("");
        lines.push(`*${s.label}:* ${s.body.trim()}`);
        break;
      case "voteTally":
        lines.push("");
        lines.push(`*Vote:* ✅ ${s.yes}  ·  ❌ ${s.no}  ·  • ${s.abstain}`);
        break;
      case "footer":
        if (deepLink) {
          lines.push("");
          lines.push(`<${deepLink}|Open in Quorum>`);
        }
        break;
    }
  }
  return lines.join("\n");
}
