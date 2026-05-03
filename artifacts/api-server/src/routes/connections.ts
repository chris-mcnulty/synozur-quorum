import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tenantConnectionsTable,
  groundingSelectorsTable,
  groundingRefreshDiffsTable,
  sessionGroundingSnapshotsTable,
  boardsTable,
  boardMembersTable,
  advisorySessionsTable,
  GROUNDING_PROVIDERS,
  type GroundingProvider,
  type TenantConnection,
  type GroundingSelector,
  type SessionGroundingSnapshot,
  type GroundingRefreshDiff,
  tenantNotificationsTable,
  type TenantNotification,
} from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireTenantRole, requireUser } from "../lib/tenantAuth";
import { fetchConnectorCredential } from "../lib/replitConnectors";
import { fetchSnapshot, refreshSelector } from "../lib/grounding";

const router: IRouter = Router();

function isProvider(s: string): s is GroundingProvider {
  return (GROUNDING_PROVIDERS as readonly string[]).includes(s);
}

function serializeConnection(c: TenantConnection, available: boolean) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    provider: c.provider,
    accountLabel: c.accountLabel,
    enabledAt: c.enabledAt.toISOString(),
    available,
  };
}

function serializeSelector(s: GroundingSelector) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    boardId: s.boardId,
    boardMemberId: s.boardMemberId,
    provider: s.provider,
    name: s.name,
    queryJson: s.queryJson as Record<string, unknown>,
    tokenBudget: s.tokenBudget,
    ordering: s.ordering,
    autoRefreshEnabled: s.autoRefreshEnabled,
    lastRefreshedAt: s.lastRefreshedAt ? s.lastRefreshedAt.toISOString() : null,
    lastContentHash: s.lastContentHash,
    lastTokenEstimate: s.lastTokenEstimate,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function serializeDiff(d: GroundingRefreshDiff) {
  return {
    id: d.id,
    tenantId: d.tenantId,
    selectorId: d.selectorId,
    boardId: d.boardId,
    boardMemberId: d.boardMemberId,
    provider: d.provider,
    selectorName: d.selectorName,
    previousHash: d.previousHash,
    newHash: d.newHash,
    previousTokenEstimate: d.previousTokenEstimate,
    newTokenEstimate: d.newTokenEstimate,
    changeKind: d.changeKind,
    materiallyChanged: d.materiallyChanged,
    fetchStatus: d.fetchStatus,
    errorDetail: d.errorDetail,
    contentSnippet: d.contentSnippet,
    acknowledgedAt: d.acknowledgedAt ? d.acknowledgedAt.toISOString() : null,
    acknowledgedBy: d.acknowledgedBy,
    createdAt: d.createdAt.toISOString(),
  };
}

function serializeSnapshot(s: SessionGroundingSnapshot) {
  return {
    id: s.id,
    sessionId: s.sessionId,
    selectorId: s.selectorId,
    boardMemberId: s.boardMemberId,
    provider: s.provider,
    selectorName: s.selectorName,
    queryJson: s.queryJson as Record<string, unknown>,
    contentText: s.contentText,
    tokenEstimate: s.tokenEstimate,
    truncated: s.truncated,
    fetchStatus: s.fetchStatus,
    errorDetail: s.errorDetail,
    fetchedAt: s.fetchedAt.toISOString(),
  };
}

// List connections for a tenant (returns one row per provider, with available flag)
router.get(
  "/tenants/:tenantId/connections",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;

    const rows = await db
      .select()
      .from(tenantConnectionsTable)
      .where(eq(tenantConnectionsTable.tenantId, tenantId));
    const enabledByProvider = new Map(rows.map((r) => [r.provider, r]));

    const result = await Promise.all(
      GROUNDING_PROVIDERS.map(async (p) => {
        const cred = await fetchConnectorCredential(p).catch(() => null);
        const enabled = enabledByProvider.get(p);
        if (enabled) {
          return serializeConnection(enabled, Boolean(cred));
        }
        return {
          id: null,
          tenantId,
          provider: p,
          accountLabel: cred?.accountLabel ?? null,
          enabledAt: null,
          available: Boolean(cred),
        };
      }),
    );
    res.json(result);
  },
);

// Activate a connection for a tenant
router.post(
  "/tenants/:tenantId/connections/:provider",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const provider = req.params.provider as string;
    if (!isProvider(provider)) {
      res.status(400).json({ error: "Unsupported provider" });
      return;
    }
    const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
    if (!ctx) return;

    const cred = await fetchConnectorCredential(provider).catch(() => null);
    if (!cred) {
      res.status(412).json({
        error:
          "This integration has not been authorized in this Replit workspace. Connect it via Replit integrations first.",
      });
      return;
    }
    const existing = await db
      .select()
      .from(tenantConnectionsTable)
      .where(
        and(
          eq(tenantConnectionsTable.tenantId, tenantId),
          eq(tenantConnectionsTable.provider, provider),
        ),
      )
      .limit(1);
    let row;
    if (existing.length > 0) {
      [row] = await db
        .update(tenantConnectionsTable)
        .set({ accountLabel: cred.accountLabel })
        .where(eq(tenantConnectionsTable.id, existing[0].id))
        .returning();
    } else {
      [row] = await db
        .insert(tenantConnectionsTable)
        .values({
          tenantId,
          provider,
          accountLabel: cred.accountLabel,
          enabledBy: ctx.userId,
        })
        .returning();
    }
    res.status(201).json(serializeConnection(row, true));
  },
);

router.delete(
  "/tenants/:tenantId/connections/:provider",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const provider = req.params.provider as string;
    const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
    if (!ctx) return;
    await db
      .delete(tenantConnectionsTable)
      .where(
        and(
          eq(tenantConnectionsTable.tenantId, tenantId),
          eq(tenantConnectionsTable.provider, provider),
        ),
      );
    res.status(204).end();
  },
);

// List grounding selectors (by board or member)
router.get("/grounding-selectors", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const boardId = req.query.boardId as string | undefined;
  const memberId = req.query.memberId as string | undefined;
  if (!boardId && !memberId) {
    res.status(400).json({ error: "boardId or memberId required" });
    return;
  }
  // Resolve the board to authorize tenant access
  let board;
  if (boardId) {
    [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, boardId))
      .limit(1);
  } else if (memberId) {
    const [m] = await db
      .select()
      .from(boardMembersTable)
      .where(eq(boardMembersTable.id, memberId))
      .limit(1);
    if (!m) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, m.boardId))
      .limit(1);
  }
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
  if (!ctx) return;

  const rows = await db
    .select()
    .from(groundingSelectorsTable)
    .where(
      memberId
        ? eq(groundingSelectorsTable.boardMemberId, memberId)
        : and(
            eq(groundingSelectorsTable.boardId, boardId!),
            // board-level selectors only have boardId, not memberId
          )!,
    )
    .orderBy(groundingSelectorsTable.ordering);
  // Filter board-level: those where boardMemberId is null
  const filtered = memberId
    ? rows
    : rows.filter((r) => r.boardMemberId === null);
  res.json(filtered.map(serializeSelector));
});

// Create selector
router.post("/grounding-selectors", async (req: Request, res: Response) => {
  const body = req.body as {
    boardId?: string;
    boardMemberId?: string;
    provider?: string;
    name?: string;
    queryJson?: Record<string, unknown>;
    tokenBudget?: number;
  };
  if (!body.provider || !isProvider(body.provider)) {
    res.status(400).json({ error: "Unsupported provider" });
    return;
  }
  if (!body.name || !body.queryJson) {
    res.status(400).json({ error: "name and queryJson are required" });
    return;
  }
  let board;
  if (body.boardMemberId) {
    const [m] = await db
      .select()
      .from(boardMembersTable)
      .where(eq(boardMembersTable.id, body.boardMemberId))
      .limit(1);
    if (!m) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, m.boardId))
      .limit(1);
  } else if (body.boardId) {
    [board] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, body.boardId))
      .limit(1);
  }
  if (!board) {
    res.status(400).json({ error: "boardId or boardMemberId required" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "EDITOR");
  if (!ctx) return;

  const [row] = await db
    .insert(groundingSelectorsTable)
    .values({
      tenantId: board.tenantId,
      boardId: body.boardMemberId ? null : board.id,
      boardMemberId: body.boardMemberId ?? null,
      provider: body.provider,
      name: body.name,
      queryJson: body.queryJson,
      tokenBudget: Math.max(200, Math.min(20000, body.tokenBudget ?? 2000)),
    })
    .returning();
  res.status(201).json(serializeSelector(row));
});

router.patch(
  "/grounding-selectors/:id",
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const [row] = await db
      .select()
      .from(groundingSelectorsTable)
      .where(eq(groundingSelectorsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Selector not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, row.tenantId, "EDITOR");
    if (!ctx) return;
    const body = req.body as {
      name?: string;
      queryJson?: Record<string, unknown>;
      tokenBudget?: number;
      autoRefreshEnabled?: boolean;
    };
    const [updated] = await db
      .update(groundingSelectorsTable)
      .set({
        name: body.name ?? row.name,
        queryJson: body.queryJson ?? (row.queryJson as Record<string, unknown>),
        tokenBudget:
          typeof body.tokenBudget === "number"
            ? Math.max(200, Math.min(20000, body.tokenBudget))
            : row.tokenBudget,
        autoRefreshEnabled:
          typeof body.autoRefreshEnabled === "boolean"
            ? body.autoRefreshEnabled
            : row.autoRefreshEnabled,
        updatedAt: new Date(),
      })
      .where(eq(groundingSelectorsTable.id, id))
      .returning();
    res.json(serializeSelector(updated));
  },
);

// Manual refresh — fetches a selector now and records a diff if changed
router.post(
  "/grounding-selectors/:id/refresh",
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const [row] = await db
      .select()
      .from(groundingSelectorsTable)
      .where(eq(groundingSelectorsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Selector not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, row.tenantId, "EDITOR");
    if (!ctx) return;
    const result = await refreshSelector(row);
    res.json(result);
  },
);

// List grounding refresh diffs (notification queue) for a tenant
router.get(
  "/tenants/:tenantId/grounding-refresh-diffs",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;
    const onlyUnacknowledged = req.query.unacknowledged === "true";
    const onlyMaterial = req.query.material === "true";
    const conditions = [eq(groundingRefreshDiffsTable.tenantId, tenantId)];
    if (onlyUnacknowledged) {
      conditions.push(isNull(groundingRefreshDiffsTable.acknowledgedAt));
    }
    if (onlyMaterial) {
      conditions.push(eq(groundingRefreshDiffsTable.materiallyChanged, true));
    }
    const rows = await db
      .select()
      .from(groundingRefreshDiffsTable)
      .where(and(...conditions))
      .orderBy(desc(groundingRefreshDiffsTable.createdAt))
      .limit(200);
    res.json(rows.map(serializeDiff));
  },
);

// Acknowledge a diff (marks notification as read)
router.post(
  "/grounding-refresh-diffs/:id/acknowledge",
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const [row] = await db
      .select()
      .from(groundingRefreshDiffsTable)
      .where(eq(groundingRefreshDiffsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Diff not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, row.tenantId, "EDITOR");
    if (!ctx) return;
    const [updated] = await db
      .update(groundingRefreshDiffsTable)
      .set({ acknowledgedAt: new Date(), acknowledgedBy: ctx.userId })
      .where(eq(groundingRefreshDiffsTable.id, id))
      .returning();
    res.json(serializeDiff(updated));
  },
);

router.delete(
  "/grounding-selectors/:id",
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const [row] = await db
      .select()
      .from(groundingSelectorsTable)
      .where(eq(groundingSelectorsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(204).end();
      return;
    }
    const ctx = await requireTenantRole(req, res, row.tenantId, "EDITOR");
    if (!ctx) return;
    await db
      .delete(groundingSelectorsTable)
      .where(eq(groundingSelectorsTable.id, id));
    res.status(204).end();
  },
);

// Live preview — fetches a selector right now
router.post(
  "/grounding-selectors/preview",
  async (req: Request, res: Response) => {
    const body = req.body as {
      tenantId?: string;
      provider?: string;
      queryJson?: Record<string, unknown>;
      tokenBudget?: number;
    };
    if (!body.tenantId || !body.provider || !body.queryJson) {
      res
        .status(400)
        .json({ error: "tenantId, provider, queryJson required" });
      return;
    }
    if (!isProvider(body.provider)) {
      res.status(400).json({ error: "Unsupported provider" });
      return;
    }
    const ctx = await requireTenantRole(req, res, body.tenantId, "VIEWER");
    if (!ctx) return;
    const out = await fetchSnapshot({
      provider: body.provider,
      query: body.queryJson,
      tokenBudget: Math.max(200, Math.min(20000, body.tokenBudget ?? 2000)),
    });
    res.json(out);
  },
);

// Snapshots for a session (audit surface)
router.get(
  "/sessions/:sessionId/grounding-snapshots",
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const [session] = await db
      .select()
      .from(advisorySessionsTable)
      .where(eq(advisorySessionsTable.id, sessionId))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;
    const rows = await db
      .select()
      .from(sessionGroundingSnapshotsTable)
      .where(eq(sessionGroundingSnapshotsTable.sessionId, sessionId))
      .orderBy(desc(sessionGroundingSnapshotsTable.fetchedAt));
    res.json(rows.map(serializeSnapshot));
  },
);

function serializeNotification(n: TenantNotification) {
  return {
    id: n.id,
    tenantId: n.tenantId,
    userId: n.userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    refType: n.refType,
    refId: n.refId,
    payload: (n.payload ?? null) as Record<string, unknown> | null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

// List notifications for the current user within a tenant
router.get(
  "/tenants/:tenantId/notifications",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;
    const onlyUnread = req.query.unread === "true";
    const conditions = [
      eq(tenantNotificationsTable.tenantId, tenantId),
      eq(tenantNotificationsTable.userId, ctx.userId),
    ];
    if (onlyUnread) {
      conditions.push(isNull(tenantNotificationsTable.readAt));
    }
    const rows = await db
      .select()
      .from(tenantNotificationsTable)
      .where(and(...conditions))
      .orderBy(desc(tenantNotificationsTable.createdAt))
      .limit(200);
    res.json(rows.map(serializeNotification));
  },
);

// Mark a notification as read
router.post(
  "/notifications/:id/read",
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = requireUser(req, res);
    if (!userId) return;
    const [row] = await db
      .select()
      .from(tenantNotificationsTable)
      .where(eq(tenantNotificationsTable.id, id))
      .limit(1);
    if (!row || row.userId !== userId) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    const [updated] = await db
      .update(tenantNotificationsTable)
      .set({ readAt: new Date() })
      .where(eq(tenantNotificationsTable.id, id))
      .returning();
    res.json(serializeNotification(updated));
  },
);

export default router;
