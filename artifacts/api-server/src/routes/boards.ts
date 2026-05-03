import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, boardsTable, boardMembersTable, advisorySessionsTable, groundingDocumentsTable, type BoardMember, type GroundingDocument, } from "@workspace/db";
import { count, desc, eq, inArray, max } from "drizzle-orm";
import { apiOps, CreateBoardBody, UpdateBoardBody } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  DEFAULT_MASTER_INSTRUCTIONS,
} from "../lib/templates";
import {
  MASTER_MODEL_DEFAULT,
  MEMBER_MODEL_DEFAULT,
} from "../lib/anthropic";

const router: IRouter = Router();

function serializeBoard(b: typeof boardsTable.$inferSelect) {
  return {
    id: b.id,
    tenantId: b.tenantId,
    name: b.name,
    description: b.description,
    topicArea: b.topicArea,
    masterInstructionsText: b.masterInstructionsText,
    size: b.size,
    defaultMemberModel: b.defaultMemberModel,
    defaultMasterModel: b.defaultMasterModel,
    temperature: Number(b.temperature),
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function serializeMember(
  m: BoardMember,
  doc?: GroundingDocument | null,
) {
  return {
    id: m.id,
    boardId: m.boardId,
    name: m.name,
    roleTitle: m.roleTitle,
    lensDescription: m.lensDescription,
    instructionsText: m.instructionsText,
    groundingDocumentId: m.groundingDocumentId,
    groundingDocument: doc
      ? {
          id: doc.id,
          tenantId: doc.tenantId,
          filename: doc.filename,
          contentType: doc.contentType,
          storagePath: doc.storagePath,
          characterCount: doc.characterCount,
          truncated: doc.truncated,
          uploadedAt: doc.uploadedAt.toISOString(),
        }
      : null,
    modelOverride: m.modelOverride,
    ordering: m.ordering,
    createdAt: m.createdAt.toISOString(),
  };
}

// List boards for a tenant
router.get(
  "/tenants/:tenantId/boards",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;

    const boards = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.tenantId, tenantId))
      .orderBy(desc(boardsTable.updatedAt));

    if (boards.length === 0) {
      res.json([]);
      return;
    }

    const ids = boards.map((b) => b.id);

    const memberCounts = await db
      .select({
        boardId: boardMembersTable.boardId,
        count: count(boardMembersTable.id).as("count"),
      })
      .from(boardMembersTable)
      .where(inArray(boardMembersTable.boardId, ids))
      .groupBy(boardMembersTable.boardId);

    const sessionStats = await db
      .select({
        boardId: advisorySessionsTable.boardId,
        count: count(advisorySessionsTable.id).as("count"),
        lastAt: max(advisorySessionsTable.startedAt).as("last_at"),
      })
      .from(advisorySessionsTable)
      .where(inArray(advisorySessionsTable.boardId, ids))
      .groupBy(advisorySessionsTable.boardId);

    const memberCountMap = new Map(
      memberCounts.map((r) => [r.boardId, Number(r.count)]),
    );
    const sessionStatMap = new Map(
      sessionStats.map((r) => [
        r.boardId,
        { count: Number(r.count), lastAt: r.lastAt as Date | null },
      ]),
    );

    res.json(
      boards.map((b) => {
        const stat = sessionStatMap.get(b.id);
        return {
          id: b.id,
          tenantId: b.tenantId,
          name: b.name,
          description: b.description,
          topicArea: b.topicArea,
          size: b.size,
          memberCount: memberCountMap.get(b.id) ?? 0,
          sessionCount: stat?.count ?? 0,
          lastSessionAt: stat?.lastAt
            ? new Date(stat.lastAt).toISOString()
            : null,
          updatedAt: b.updatedAt.toISOString(),
        };
      }),
    );
  },
);

router.post(
  "/tenants/:tenantId/boards",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "EDITOR");
    if (!ctx) return;

    const parsed = apiOps.CreateBoardBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [board] = await db
      .insert(boardsTable)
      .values({
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        topicArea: parsed.data.topicArea ?? null,
        size: parsed.data.size,
        masterInstructionsText:
          parsed.data.masterInstructionsText ?? DEFAULT_MASTER_INSTRUCTIONS,
        defaultMemberModel: MEMBER_MODEL_DEFAULT,
        defaultMasterModel: MASTER_MODEL_DEFAULT,
        createdBy: ctx.userId,
      })
      .returning();

    res.status(201).json(serializeBoard(board));
  },
);

router.get("/boards/:boardId", async (req: Request, res: Response) => {
  const boardId = req.params.boardId as string;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
  if (!ctx) return;

  const members = await db
    .select()
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, board.id))
    .orderBy(boardMembersTable.ordering);

  const docIds = members
    .map((m) => m.groundingDocumentId)
    .filter((id): id is string => Boolean(id));
  const docs = docIds.length
    ? await db
        .select()
        .from(groundingDocumentsTable)
        .where(inArray(groundingDocumentsTable.id, docIds))
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  res.json({
    ...serializeBoard(board),
    members: members.map((m) =>
      serializeMember(
        m,
        m.groundingDocumentId ? docMap.get(m.groundingDocumentId) ?? null : null,
      ),
    ),
  });
});

router.patch("/boards/:boardId", async (req: Request, res: Response) => {
  const boardId = req.params.boardId as string;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "EDITOR");
  if (!ctx) return;

  const parsed = apiOps.UpdateBoardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<typeof boardsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.topicArea !== undefined)
    updates.topicArea = parsed.data.topicArea;
  if (parsed.data.masterInstructionsText != null)
    updates.masterInstructionsText = parsed.data.masterInstructionsText;
  if (parsed.data.size != null) updates.size = parsed.data.size;
  if (parsed.data.defaultMemberModel != null)
    updates.defaultMemberModel = parsed.data.defaultMemberModel;
  if (parsed.data.defaultMasterModel != null)
    updates.defaultMasterModel = parsed.data.defaultMasterModel;
  if (parsed.data.temperature != null)
    updates.temperature = String(parsed.data.temperature);

  const [updated] = await db
    .update(boardsTable)
    .set(updates)
    .where(eq(boardsTable.id, boardId))
    .returning();

  res.json(serializeBoard(updated));
});

router.delete("/boards/:boardId", async (req: Request, res: Response) => {
  const boardId = req.params.boardId as string;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "ADMIN");
  if (!ctx) return;

  await db.delete(boardsTable).where(eq(boardsTable.id, boardId));
  res.status(204).end();
});

export default router;
