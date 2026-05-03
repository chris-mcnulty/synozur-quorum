import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  advisorySessionsTable,
  sessionCommentsTable,
  sessionReactionsTable,
  sessionSummariesTable,
  followUpProposalsTable,
  boardMembersTable,
  tenantMembersTable,
  tenantNotificationsTable,
  usersTable,
  type SessionComment,
  type SessionReaction,
  type FollowUpProposal,
} from "@workspace/db";
import { and, eq, asc, inArray, ne } from "drizzle-orm";
import {
  apiOps,
  type CreateSessionCommentBody,
  type ToggleSessionReactionBody,
  type CreateFollowUpProposalBody,
} from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import { emitToSession, runSession } from "../lib/sessionRunner";
import { pingPresence, listPresence } from "../lib/presence";

const router: IRouter = Router();

const ANCHOR_TYPES = new Set(["contribution", "framing", "convergence"]);
const REACTION_KINDS = new Set(["INSIGHTFUL", "DISAGREE", "ACTION"]);

async function loadSessionWithTenant(sessionId: string) {
  const [s] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, sessionId))
    .limit(1);
  return s ?? null;
}

async function decorateUser(userId: string) {
  const [u] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!u) return { email: null, displayName: null, profileImageUrl: null };
  const display =
    u.displayName ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.email ||
    null;
  return {
    email: u.email ?? null,
    displayName: display,
    profileImageUrl: u.profileImageUrl ?? null,
  };
}

function serializeComment(
  c: SessionComment,
  decoration: { email: string | null; displayName: string | null; profileImageUrl: string | null },
) {
  return {
    id: c.id,
    sessionId: c.sessionId,
    userId: c.userId,
    userEmail: decoration.email,
    userDisplayName: decoration.displayName,
    userProfileImageUrl: decoration.profileImageUrl,
    anchorType: c.anchorType as "contribution" | "framing" | "convergence",
    anchorId: c.anchorId,
    parentCommentId: c.parentCommentId,
    bodyText: c.bodyText,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    resolvedByUserId: c.resolvedByUserId ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeReaction(
  r: SessionReaction,
  decoration: { email: string | null; displayName: string | null },
) {
  return {
    id: r.id,
    sessionId: r.sessionId,
    userId: r.userId,
    userEmail: decoration.email,
    userDisplayName: decoration.displayName,
    anchorType: r.anchorType as "contribution" | "framing" | "convergence",
    anchorId: r.anchorId,
    reactionKind: r.reactionKind as "INSIGHTFUL" | "DISAGREE" | "ACTION",
    createdAt: r.createdAt.toISOString(),
  };
}

function serializeProposal(
  p: FollowUpProposal,
  decoration: { email: string | null; displayName: string | null },
) {
  return {
    id: p.id,
    sessionId: p.sessionId,
    userId: p.userId,
    userEmail: decoration.email,
    userDisplayName: decoration.displayName,
    questionText: p.questionText,
    status: p.status as "open" | "dispatched" | "dismissed",
    dispatchedSessionId: p.dispatchedSessionId,
    createdAt: p.createdAt.toISOString(),
  };
}

// --- Comments ---

router.get(
  "/sessions/:sessionId/comments",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const rows = await db
      .select()
      .from(sessionCommentsTable)
      .where(eq(sessionCommentsTable.sessionId, session.id))
      .orderBy(asc(sessionCommentsTable.createdAt));

    const out = await Promise.all(
      rows.map(async (r) => serializeComment(r, await decorateUser(r.userId))),
    );
    res.json(out);
  },
);

router.post(
  "/sessions/:sessionId/comments",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const parsed = apiOps.CreateSessionCommentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body: CreateSessionCommentBody = parsed.data;
    if (!ANCHOR_TYPES.has(body.anchorType)) {
      res.status(400).json({ error: "Invalid anchorType" });
      return;
    }

    const [row] = await db
      .insert(sessionCommentsTable)
      .values({
        sessionId: session.id,
        tenantId: session.tenantId,
        userId: ctx.userId,
        anchorType: body.anchorType,
        anchorId: body.anchorId ?? "",
        parentCommentId: body.parentCommentId ?? null,
        bodyText: body.bodyText,
      })
      .returning();

    const decoration = await decorateUser(ctx.userId);
    const payload = serializeComment(row, decoration);

    emitToSession(session.id, {
      type: "comment_added",
      sessionId: session.id,
      payload,
    });

    res.status(201).json(payload);
  },
);

router.post(
  "/sessions/:sessionId/comments/:commentId/resolve",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const [comment] = await db
      .select()
      .from(sessionCommentsTable)
      .where(
        and(
          eq(sessionCommentsTable.id, req.params.commentId as string),
          eq(sessionCommentsTable.sessionId, session.id),
        ),
      )
      .limit(1);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    if (comment.parentCommentId) {
      res.status(400).json({ error: "Only thread roots can be resolved" });
      return;
    }

    const isAuthor = comment.userId === ctx.userId;
    const isEditor =
      ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "EDITOR";
    if (!isAuthor && !isEditor) {
      res.status(403).json({ error: "Only the author or an editor can resolve" });
      return;
    }

    const [updated] = await db
      .update(sessionCommentsTable)
      .set({ resolvedAt: new Date(), resolvedByUserId: ctx.userId })
      .where(eq(sessionCommentsTable.id, comment.id))
      .returning();

    const decoration = await decorateUser(updated.userId);
    const payload = serializeComment(updated, decoration);

    emitToSession(session.id, {
      type: "comment_resolved",
      sessionId: session.id,
      payload,
    });

    res.json(payload);
  },
);

router.delete(
  "/sessions/:sessionId/comments/:commentId/resolve",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const [comment] = await db
      .select()
      .from(sessionCommentsTable)
      .where(
        and(
          eq(sessionCommentsTable.id, req.params.commentId as string),
          eq(sessionCommentsTable.sessionId, session.id),
        ),
      )
      .limit(1);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    if (comment.parentCommentId) {
      res.status(400).json({ error: "Only thread roots can be reopened" });
      return;
    }

    const isAuthor = comment.userId === ctx.userId;
    const isEditor =
      ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "EDITOR";
    if (!isAuthor && !isEditor) {
      res.status(403).json({ error: "Only the author or an editor can reopen" });
      return;
    }

    const [updated] = await db
      .update(sessionCommentsTable)
      .set({ resolvedAt: null, resolvedByUserId: null })
      .where(eq(sessionCommentsTable.id, comment.id))
      .returning();

    const decoration = await decorateUser(updated.userId);
    const payload = serializeComment(updated, decoration);

    emitToSession(session.id, {
      type: "comment_unresolved",
      sessionId: session.id,
      payload,
    });

    res.json(payload);
  },
);

// --- Reactions (toggle) ---

router.get(
  "/sessions/:sessionId/reactions",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const rows = await db
      .select()
      .from(sessionReactionsTable)
      .where(eq(sessionReactionsTable.sessionId, session.id))
      .orderBy(asc(sessionReactionsTable.createdAt));

    const out = await Promise.all(
      rows.map(async (r) => serializeReaction(r, await decorateUser(r.userId))),
    );
    res.json(out);
  },
);

router.post(
  "/sessions/:sessionId/reactions",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const parsed = apiOps.ToggleSessionReactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body: ToggleSessionReactionBody = parsed.data;
    if (!ANCHOR_TYPES.has(body.anchorType)) {
      res.status(400).json({ error: "Invalid anchorType" });
      return;
    }
    if (!REACTION_KINDS.has(body.reactionKind)) {
      res.status(400).json({ error: "Invalid reactionKind" });
      return;
    }

    const anchorId = body.anchorId ?? "";

    const existing = await db
      .select()
      .from(sessionReactionsTable)
      .where(
        and(
          eq(sessionReactionsTable.sessionId, session.id),
          eq(sessionReactionsTable.userId, ctx.userId),
          eq(sessionReactionsTable.anchorType, body.anchorType),
          eq(sessionReactionsTable.anchorId, anchorId),
          eq(sessionReactionsTable.reactionKind, body.reactionKind),
        ),
      )
      .limit(1);

    const decoration = await decorateUser(ctx.userId);

    if (existing.length > 0) {
      await db
        .delete(sessionReactionsTable)
        .where(eq(sessionReactionsTable.id, existing[0].id));
      emitToSession(session.id, {
        type: "reaction_removed",
        sessionId: session.id,
        payload: { reactionId: existing[0].id, userId: ctx.userId },
      });
      res.json({ added: false, reaction: null });
      return;
    }

    const [row] = await db
      .insert(sessionReactionsTable)
      .values({
        sessionId: session.id,
        tenantId: session.tenantId,
        userId: ctx.userId,
        anchorType: body.anchorType,
        anchorId,
        reactionKind: body.reactionKind,
      })
      .returning();

    const reaction = serializeReaction(row, decoration);
    emitToSession(session.id, {
      type: "reaction_added",
      sessionId: session.id,
      payload: reaction,
    });
    res.json({ added: true, reaction });
  },
);

// --- Notification helpers ---

async function notifyBoardEditorsOfProposal(args: {
  tenantId: string;
  sessionId: string;
  boardId: string;
  proposalId: string;
  proposerUserId: string;
  proposerDisplayName: string | null;
  questionText: string;
}): Promise<void> {
  const recipients = await db
    .select({ userId: tenantMembersTable.userId })
    .from(tenantMembersTable)
    .where(
      and(
        eq(tenantMembersTable.tenantId, args.tenantId),
        inArray(tenantMembersTable.role, ["OWNER", "ADMIN", "EDITOR"]),
        ne(tenantMembersTable.userId, args.proposerUserId),
      ),
    );
  if (recipients.length === 0) return;
  const proposer = args.proposerDisplayName || "A board member";
  const snippet =
    args.questionText.length > 140
      ? `${args.questionText.slice(0, 140)}…`
      : args.questionText;
  await db.insert(tenantNotificationsTable).values(
    recipients.map((r) => ({
      tenantId: args.tenantId,
      userId: r.userId,
      kind: "follow_up_proposed",
      title: `${proposer} proposed a follow-up question`,
      body: snippet,
      refType: "follow_up_proposal" as const,
      refId: args.proposalId,
      payload: {
        sessionId: args.sessionId,
        boardId: args.boardId,
        proposalId: args.proposalId,
        proposerUserId: args.proposerUserId,
        link: `/sessions/${args.sessionId}#follow-ups`,
      },
    })),
  );
}

async function notifyProposerOfDispatch(args: {
  tenantId: string;
  proposerUserId: string;
  proposalId: string;
  originSessionId: string;
  branchedSessionId: string;
  questionText: string;
  dispatcherDisplayName: string | null;
}): Promise<void> {
  const dispatcher = args.dispatcherDisplayName || "An editor";
  const snippet =
    args.questionText.length > 140
      ? `${args.questionText.slice(0, 140)}…`
      : args.questionText;
  await db.insert(tenantNotificationsTable).values({
    tenantId: args.tenantId,
    userId: args.proposerUserId,
    kind: "follow_up_dispatched",
    title: `${dispatcher} branched your follow-up question`,
    body: snippet,
    refType: "follow_up_proposal" as const,
    refId: args.proposalId,
    payload: {
      proposalId: args.proposalId,
      originSessionId: args.originSessionId,
      branchedSessionId: args.branchedSessionId,
      link: `/sessions/${args.branchedSessionId}`,
    },
  });
}

// --- Follow-up proposals ---

router.get(
  "/sessions/:sessionId/follow-ups",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const rows = await db
      .select()
      .from(followUpProposalsTable)
      .where(eq(followUpProposalsTable.sessionId, session.id))
      .orderBy(asc(followUpProposalsTable.createdAt));

    const out = await Promise.all(
      rows.map(async (r) => serializeProposal(r, await decorateUser(r.userId))),
    );
    res.json(out);
  },
);

router.post(
  "/sessions/:sessionId/follow-ups",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const parsed = apiOps.CreateFollowUpProposalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body: CreateFollowUpProposalBody = parsed.data;

    const [row] = await db
      .insert(followUpProposalsTable)
      .values({
        sessionId: session.id,
        tenantId: session.tenantId,
        userId: ctx.userId,
        questionText: body.questionText,
      })
      .returning();

    const decoration = await decorateUser(ctx.userId);
    const payload = serializeProposal(row, decoration);

    emitToSession(session.id, {
      type: "follow_up_added",
      sessionId: session.id,
      payload,
    });

    try {
      await notifyBoardEditorsOfProposal({
        tenantId: session.tenantId,
        sessionId: session.id,
        boardId: session.boardId,
        proposalId: row.id,
        proposerUserId: ctx.userId,
        proposerDisplayName: decoration.displayName,
        questionText: row.questionText,
      });
    } catch (err) {
      req.log.error(
        { err, proposalId: row.id },
        "Failed to enqueue follow-up proposal notifications",
      );
    }

    res.status(201).json(payload);
  },
);

router.post(
  "/sessions/:sessionId/follow-ups/:proposalId/dispatch",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "EDITOR");
    if (!ctx) return;

    const [proposal] = await db
      .select()
      .from(followUpProposalsTable)
      .where(
        and(
          eq(followUpProposalsTable.id, req.params.proposalId as string),
          eq(followUpProposalsTable.sessionId, session.id),
        ),
      )
      .limit(1);
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    if (proposal.status !== "open") {
      res.status(409).json({ error: "Proposal already actioned" });
      return;
    }

    const memberCount = (
      await db
        .select({ id: boardMembersTable.id })
        .from(boardMembersTable)
        .where(eq(boardMembersTable.boardId, session.boardId))
    ).length;
    if (memberCount === 0) {
      res.status(400).json({ error: "Board has no members" });
      return;
    }

    const [parentSummary] = await db
      .select()
      .from(sessionSummariesTable)
      .where(eq(sessionSummariesTable.sessionId, session.id))
      .limit(1);

    const branchNote = `Follow-up question proposed by ${
      (await decorateUser(proposal.userId)).displayName || "a board member"
    } during the prior session.`;

    const [newSession] = await db
      .insert(advisorySessionsTable)
      .values({
        tenantId: session.tenantId,
        boardId: session.boardId,
        mode: session.mode,
        questionText: proposal.questionText,
        status: "running",
        createdBy: ctx.userId,
        parentSessionId: session.id,
        branchNote,
        allHands: session.allHands,
      })
      .returning();

    await db
      .update(followUpProposalsTable)
      .set({ status: "dispatched", dispatchedSessionId: newSession.id })
      .where(eq(followUpProposalsTable.id, proposal.id));

    void runSession({
      sessionId: newSession.id,
      tenantId: session.tenantId,
      boardId: session.boardId,
      mode: newSession.mode as "ADVISORY" | "BOARD" | "REVIEW",
      question: proposal.questionText,
      allHands: session.allHands,
      branchContext: {
        parentQuestion: session.questionText,
        parentFinalSummary: parentSummary?.finalSummary ?? null,
        parentConvergenceNote: parentSummary?.convergenceNote ?? null,
        branchNote,
      },
    }).catch((err) => {
      req.log.error({ err, sessionId: newSession.id }, "Branched session crashed");
    });

    const decoration = await decorateUser(proposal.userId);
    const updatedProposal = serializeProposal(
      { ...proposal, status: "dispatched", dispatchedSessionId: newSession.id },
      decoration,
    );
    const sessionPayload = {
      id: newSession.id,
      boardId: newSession.boardId,
      mode: newSession.mode,
      questionText: newSession.questionText,
      status: newSession.status,
      startedAt: newSession.startedAt.toISOString(),
      completedAt: newSession.completedAt
        ? newSession.completedAt.toISOString()
        : null,
      totalCostCents: newSession.totalCostCents ?? null,
    };

    emitToSession(session.id, {
      type: "follow_up_dispatched",
      sessionId: session.id,
      payload: { proposal: updatedProposal, session: sessionPayload },
    });

    if (proposal.userId && proposal.userId !== ctx.userId) {
      try {
        const dispatcher = await decorateUser(ctx.userId);
        await notifyProposerOfDispatch({
          tenantId: session.tenantId,
          proposerUserId: proposal.userId,
          proposalId: proposal.id,
          originSessionId: session.id,
          branchedSessionId: newSession.id,
          questionText: proposal.questionText,
          dispatcherDisplayName: dispatcher.displayName,
        });
      } catch (err) {
        req.log.error(
          { err, proposalId: proposal.id },
          "Failed to enqueue follow-up dispatch notification",
        );
      }
    }

    res.status(201).json({ proposal: updatedProposal, session: sessionPayload });
  },
);

// --- Presence ---

router.get(
  "/sessions/:sessionId/presence",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;
    res.json(listPresence(session.id));
  },
);

router.post(
  "/sessions/:sessionId/presence",
  async (req: Request, res: Response) => {
    const session = await loadSessionWithTenant(req.params.sessionId as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;

    const decoration = await decorateUser(ctx.userId);
    pingPresence(session.id, {
      userId: ctx.userId,
      email: decoration.email,
      displayName: decoration.displayName,
    });

    const list = listPresence(session.id);
    emitToSession(session.id, {
      type: "presence",
      sessionId: session.id,
      payload: list,
    });
    res.json(list);
  },
);

export default router;
