import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tenantAdvisorsTable,
  boardsTable,
  boardMembersTable,
  groundingDocumentsTable,
} from "@workspace/db";
import { eq, max } from "drizzle-orm";
import { apiOps } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";

const router: IRouter = Router();

function serializeAdvisor(
  a: typeof tenantAdvisorsTable.$inferSelect,
  doc: typeof groundingDocumentsTable.$inferSelect | null,
) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    name: a.name,
    roleTitle: a.roleTitle,
    lensDescription: a.lensDescription,
    instructionsText: a.instructionsText,
    groundingDocumentId: a.groundingDocumentId,
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
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/tenant-advisors", async (req: Request, res: Response) => {
  const { tenantId } = req.query;
  if (!tenantId || typeof tenantId !== "string") {
    res.status(400).json({ error: "tenantId query param is required" });
    return;
  }
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  const advisors = await db
    .select()
    .from(tenantAdvisorsTable)
    .where(eq(tenantAdvisorsTable.tenantId, tenantId))
    .orderBy(tenantAdvisorsTable.createdAt);

  const docIds = advisors
    .map((a) => a.groundingDocumentId)
    .filter((x): x is string => Boolean(x));
  const docs = docIds.length
    ? await db
        .select()
        .from(groundingDocumentsTable)
        .where(eq(groundingDocumentsTable.tenantId, tenantId))
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  res.json(
    advisors.map((a) =>
      serializeAdvisor(
        a,
        a.groundingDocumentId ? docMap.get(a.groundingDocumentId) ?? null : null,
      ),
    ),
  );
});

router.post("/tenant-advisors", async (req: Request, res: Response) => {
  const parsed = apiOps.CreateRosterAdvisorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const ctx = await requireTenantRole(req, res, parsed.data.tenantId, "EDITOR");
  if (!ctx) return;

  const [a] = await db
    .insert(tenantAdvisorsTable)
    .values({
      tenantId: parsed.data.tenantId,
      name: parsed.data.name,
      roleTitle: parsed.data.roleTitle,
      lensDescription: parsed.data.lensDescription ?? null,
      instructionsText: parsed.data.instructionsText ?? "",
    })
    .returning();

  res.status(201).json(serializeAdvisor(a, null));
});

router.patch("/tenant-advisors/:advisorId", async (req: Request, res: Response) => {
  const advisorId = req.params.advisorId as string;
  const [existing] = await db
    .select()
    .from(tenantAdvisorsTable)
    .where(eq(tenantAdvisorsTable.id, advisorId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Advisor not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, existing.tenantId, "EDITOR");
  if (!ctx) return;

  const parsed = apiOps.UpdateRosterAdvisorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<typeof tenantAdvisorsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.roleTitle != null) updates.roleTitle = parsed.data.roleTitle;
  if (parsed.data.lensDescription !== undefined)
    updates.lensDescription = parsed.data.lensDescription;
  if (parsed.data.instructionsText != null)
    updates.instructionsText = parsed.data.instructionsText;
  if (parsed.data.groundingDocumentId !== undefined)
    updates.groundingDocumentId = parsed.data.groundingDocumentId;

  const [updated] = await db
    .update(tenantAdvisorsTable)
    .set(updates)
    .where(eq(tenantAdvisorsTable.id, advisorId))
    .returning();

  let doc: typeof groundingDocumentsTable.$inferSelect | null = null;
  if (updated.groundingDocumentId) {
    const [d] = await db
      .select()
      .from(groundingDocumentsTable)
      .where(eq(groundingDocumentsTable.id, updated.groundingDocumentId))
      .limit(1);
    doc = d ?? null;
  }

  res.json(serializeAdvisor(updated, doc));
});

router.delete("/tenant-advisors/:advisorId", async (req: Request, res: Response) => {
  const advisorId = req.params.advisorId as string;
  const [existing] = await db
    .select()
    .from(tenantAdvisorsTable)
    .where(eq(tenantAdvisorsTable.id, advisorId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Advisor not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, existing.tenantId, "EDITOR");
  if (!ctx) return;

  await db
    .delete(tenantAdvisorsTable)
    .where(eq(tenantAdvisorsTable.id, advisorId));
  res.status(204).end();
});

router.post(
  "/boards/:boardId/seat-roster-advisor",
  async (req: Request, res: Response) => {
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

    const parsed = apiOps.SeatRosterAdvisorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [advisor] = await db
      .select()
      .from(tenantAdvisorsTable)
      .where(eq(tenantAdvisorsTable.id, parsed.data.rosterAdvisorId))
      .limit(1);
    if (!advisor) {
      res.status(404).json({ error: "Roster advisor not found" });
      return;
    }
    if (advisor.tenantId !== board.tenantId) {
      res.status(403).json({ error: "Advisor does not belong to this tenant" });
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
        name: advisor.name,
        roleTitle: advisor.roleTitle,
        lensDescription: advisor.lensDescription ?? null,
        instructionsText: advisor.instructionsText,
        groundingDocumentId: advisor.groundingDocumentId ?? null,
        ordering: ((next as number | null) ?? -1) + 1,
      })
      .returning();

    res.status(201).json({
      id: m.id,
      boardId: m.boardId,
      name: m.name,
      roleTitle: m.roleTitle,
      lensDescription: m.lensDescription,
      instructionsText: m.instructionsText,
      groundingDocumentId: m.groundingDocumentId,
      groundingDocument: null,
      modelOverride: m.modelOverride,
      ordering: m.ordering,
      createdAt: m.createdAt.toISOString(),
    });
  },
);

export default router;
