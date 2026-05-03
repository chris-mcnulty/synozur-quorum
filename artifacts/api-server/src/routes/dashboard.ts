import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tenantsTable,
  tenantMembersTable,
  boardsTable,
  boardMembersTable,
  advisorySessionsTable,
} from "@workspace/db";
import { count, desc, eq, inArray } from "drizzle-orm";
import { requireTenantRole } from "../lib/tenantAuth";

const router: IRouter = Router();

router.get(
  "/tenants/:tenantId/dashboard",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const boards = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.tenantId, tenantId))
      .orderBy(desc(boardsTable.updatedAt));

    const boardIds = boards.map((b) => b.id);

    const memberCountRows = boardIds.length
      ? await db
          .select({
            boardId: boardMembersTable.boardId,
            c: count(boardMembersTable.id).as("c"),
          })
          .from(boardMembersTable)
          .where(inArray(boardMembersTable.boardId, boardIds))
          .groupBy(boardMembersTable.boardId)
      : [];
    const memberCountMap = new Map(
      memberCountRows.map((r) => [r.boardId, Number(r.c)]),
    );

    const recentSessions = await db
      .select()
      .from(advisorySessionsTable)
      .where(eq(advisorySessionsTable.tenantId, tenantId))
      .orderBy(desc(advisorySessionsTable.startedAt))
      .limit(8);

    const sessionCounts = boardIds.length
      ? await db
          .select({
            boardId: advisorySessionsTable.boardId,
            c: count(advisorySessionsTable.id).as("c"),
          })
          .from(advisorySessionsTable)
          .where(inArray(advisorySessionsTable.boardId, boardIds))
          .groupBy(advisorySessionsTable.boardId)
      : [];
    const sessionCountMap = new Map(
      sessionCounts.map((r) => [r.boardId, Number(r.c)]),
    );

    const [{ totalSessions }] = await db
      .select({ totalSessions: count(advisorySessionsTable.id) })
      .from(advisorySessionsTable)
      .where(eq(advisorySessionsTable.tenantId, tenantId));

    const [{ totalMembers }] = await db
      .select({ totalMembers: count(tenantMembersTable.userId) })
      .from(tenantMembersTable)
      .where(eq(tenantMembersTable.tenantId, tenantId));

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt.toISOString(),
      },
      boards: boards.map((b) => ({
        id: b.id,
        tenantId: b.tenantId,
        name: b.name,
        description: b.description,
        topicArea: b.topicArea,
        size: b.size,
        memberCount: memberCountMap.get(b.id) ?? 0,
        sessionCount: sessionCountMap.get(b.id) ?? 0,
        lastSessionAt: null,
        updatedAt: b.updatedAt.toISOString(),
      })),
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        boardId: s.boardId,
        mode: s.mode,
        questionText: s.questionText,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt ? s.completedAt.toISOString() : null,
        totalCostCents: s.totalCostCents ?? null,
        parentSessionId: s.parentSessionId ?? null,
        branchNote: s.branchNote ?? null,
      })),
      counts: {
        boards: boards.length,
        sessions: Number(totalSessions),
        members: Number(totalMembers),
      },
    });
  },
);

export default router;
