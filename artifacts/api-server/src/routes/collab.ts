import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  advisorySessionsTable,
  sessionCommentsTable,
  sessionReactionsTable,
  followUpProposalsTable,
  boardMembersTable,
  usersTable,
  type SessionComment,
  type SessionReaction,
  type FollowUpProposal,
} from "@workspace/db";
import { and, eq, asc } from "drizzle-orm";
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

    const [newSession] = await db
      .insert(advisorySessionsTable)
      .values({
        tenantId: session.tenantId,
        boardId: session.boardId,
        mode: session.mode,
        questionText: proposal.questionText,
        status: "running",
        createdBy: ctx.userId,
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
      allHands: false,
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
