import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, boardsTable, boardMembersTable, groundingDocumentsTable, } from "@workspace/db";
import { eq, max } from "drizzle-orm";
import { apiOps, CreateBoardMemberBody, UpdateBoardMemberBody } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import { DEFAULT_MEMBER_INSTRUCTIONS } from "../lib/templates";

const router: IRouter = Router();

function serializeMember(
  m: typeof boardMembersTable.$inferSelect,
  doc: typeof groundingDocumentsTable.$inferSelect | null,
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

async function loadBoardForMember(memberId: string) {
  const [m] = await db
    .select()
    .from(boardMembersTable)
    .where(eq(boardMembersTable.id, memberId))
    .limit(1);
  if (!m) return null;
  const [b] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, m.boardId))
    .limit(1);
  return b ? { board: b, member: m } : null;
}

router.get("/boards/:boardId/members", async (req: Request, res: Response) => {
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
    .where(eq(boardMembersTable.boardId, boardId))
    .orderBy(boardMembersTable.ordering);

  const docIds = members
    .map((m) => m.groundingDocumentId)
    .filter((x): x is string => Boolean(x));
  const docs = docIds.length
    ? await db
        .select()
        .from(groundingDocumentsTable)
        .where(eq(groundingDocumentsTable.tenantId, board.tenantId))
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  res.json(
    members.map((m) =>
      serializeMember(
        m,
        m.groundingDocumentId ? docMap.get(m.groundingDocumentId) ?? null : null,
      ),
    ),
  );
});

router.post("/boards/:boardId/members", async (req: Request, res: Response) => {
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

  const parsed = apiOps.CreateBoardMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [{ next }] = await db
    .select({ next: max(boardMembersTable.ordering) })
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, boardId));

  const [m] = await db
    .insert(boardMembersTable)
    .values({
      boardId,
      name: parsed.data.name,
      roleTitle: parsed.data.roleTitle,
      lensDescription: parsed.data.lensDescription ?? null,
      instructionsText:
        parsed.data.instructionsText ?? DEFAULT_MEMBER_INSTRUCTIONS,
      groundingDocumentId: parsed.data.groundingDocumentId ?? null,
      modelOverride: parsed.data.modelOverride ?? null,
      ordering: ((next as number | null) ?? -1) + 1,
    })
    .returning();

  res.status(201).json(serializeMember(m, null));
});

router.patch("/board-members/:memberId", async (req: Request, res: Response) => {
  const memberId = req.params.memberId as string;
  const ctx0 = await loadBoardForMember(memberId);
  if (!ctx0) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const ctx = await requireTenantRole(
    req,
    res,
    ctx0.board.tenantId,
    "EDITOR",
  );
  if (!ctx) return;

  const parsed = apiOps.UpdateBoardMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<typeof boardMembersTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.roleTitle != null) updates.roleTitle = parsed.data.roleTitle;
  if (parsed.data.lensDescription !== undefined)
    updates.lensDescription = parsed.data.lensDescription;
  if (parsed.data.instructionsText != null)
    updates.instructionsText = parsed.data.instructionsText;
  if (parsed.data.groundingDocumentId !== undefined)
    updates.groundingDocumentId = parsed.data.groundingDocumentId;
  if (parsed.data.modelOverride !== undefined)
    updates.modelOverride = parsed.data.modelOverride;
  if (parsed.data.ordering != null) updates.ordering = parsed.data.ordering;

  const [m] = await db
    .update(boardMembersTable)
    .set(updates)
    .where(eq(boardMembersTable.id, memberId))
    .returning();

  let doc: typeof groundingDocumentsTable.$inferSelect | null = null;
  if (m.groundingDocumentId) {
    const [d] = await db
      .select()
      .from(groundingDocumentsTable)
      .where(eq(groundingDocumentsTable.id, m.groundingDocumentId))
      .limit(1);
    doc = d ?? null;
  }
  res.json(serializeMember(m, doc));
});

router.delete(
  "/board-members/:memberId",
  async (req: Request, res: Response) => {
    const memberId = req.params.memberId as string;
    const ctx0 = await loadBoardForMember(memberId);
    if (!ctx0) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const ctx = await requireTenantRole(
      req,
      res,
      ctx0.board.tenantId,
      "EDITOR",
    );
    if (!ctx) return;

    await db
      .delete(boardMembersTable)
      .where(eq(boardMembersTable.id, memberId));
    res.status(204).end();
  },
);

export default router;
