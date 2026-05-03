import type { SessionMemo } from "./generated/types/sessionMemo";
import type { SessionMemoVotesItem } from "./generated/types/sessionMemoVotesItem";

export type MemoVoteRow = {
  memberName: string | null;
  memberRoleTitle: string | null;
  vote: SessionMemoVotesItem["vote"];
};

export type MemoSection =
  | {
      kind: "header";
      boardName: string;
      questionText: string;
      mode: SessionMemo["mode"];
      sessionId: string;
    }
  | { kind: "text"; label: string; body: string }
  | {
      kind: "voteTally";
      yes: number;
      no: number;
      abstain: number;
      votes: MemoVoteRow[];
    }
  | { kind: "footer"; boardName: string; date: string };

function asDate(value: SessionMemo["completedAt"] | SessionMemo["startedAt"]): Date {
  if (!value) return new Date(0);
  return value instanceof Date ? value : new Date(value as unknown as string);
}

export function getMemoSections(memo: SessionMemo): MemoSection[] {
  const out: MemoSection[] = [];

  out.push({
    kind: "header",
    boardName: memo.boardName,
    questionText: memo.questionText,
    mode: memo.mode,
    sessionId: memo.sessionId,
  });

  if (memo.recommendation) {
    out.push({ kind: "text", label: "Recommendation", body: memo.recommendation });
  }

  if (memo.mode === "BOARD") {
    out.push({
      kind: "voteTally",
      yes: memo.voteTally.yes,
      no: memo.voteTally.no,
      abstain: memo.voteTally.abstain,
      votes: memo.votes.map((v) => ({
        memberName: v.memberName ?? null,
        memberRoleTitle: v.memberRoleTitle ?? null,
        vote: v.vote ?? null,
      })),
    });
  }

  if (memo.keyDissent) {
    out.push({ kind: "text", label: "Key dissent", body: memo.keyDissent });
  }
  if (memo.openQuestionsText) {
    out.push({ kind: "text", label: "Open questions", body: memo.openQuestionsText });
  }
  if (memo.flagsRaisedText) {
    out.push({ kind: "text", label: "Flags raised", body: memo.flagsRaisedText });
  }

  const ref = memo.completedAt ?? memo.startedAt;
  const date = asDate(ref).toLocaleDateString();
  out.push({ kind: "footer", boardName: memo.boardName, date });

  return out;
}
