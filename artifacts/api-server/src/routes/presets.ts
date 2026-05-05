import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  boardsTable,
  boardMembersTable,
  groundingDocumentsTable,
} from "@workspace/db";
import { eq, max } from "drizzle-orm";
import { apiOps } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  ADVISOR_PRESETS,
  BOARD_TEMPLATES,
  findPreset,
  findBoardTemplate,
  type AdvisorPreset,
} from "../lib/presets";

async function findGlobalGroundingForPreset(
  slug: string,
): Promise<string | null> {
  const [doc] = await db
    .select({ id: groundingDocumentsTable.id })
    .from(groundingDocumentsTable)
    .where(eq(groundingDocumentsTable.presetSlug, slug))
    .limit(1);
  return doc?.id ?? null;
}

const router: IRouter = Router();

function serializePreset(p: AdvisorPreset) {
  return {
    slug: p.slug,
    name: p.name,
    roleTitle: p.roleTitle,
    category: p.category,
    kind: p.kind,
    tags: p.tags,
    lensDescription: p.lensDescription,
    instructionsText: p.instructionsText,
  };
}

router.get("/presets/advisors", (_req: Request, res: Response) => {
  res.json(ADVISOR_PRESETS.map(serializePreset));
});

router.get("/presets/board-templates", (_req: Request, res: Response) => {
  res.json(
    BOARD_TEMPLATES.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      size: t.size,
      topicArea: t.topicArea,
      presetSlugs: t.presetSlugs,
      presets: t.presetSlugs
        .map((s) => findPreset(s))
        .filter((p): p is AdvisorPreset => Boolean(p))
        .map(serializePreset),
    })),
  );
});

function serializeMember(m: typeof boardMembersTable.$inferSelect) {
  return {
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
    fromPresetSlug: m.fromPresetSlug,
    createdAt: m.createdAt.toISOString(),
  };
}

router.post(
  "/boards/:boardId/seat-preset",
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

    const parsed = apiOps.SeatAdvisorPresetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const preset = findPreset(parsed.data.presetSlug);
    if (!preset) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }

    const [{ next }] = await db
      .select({ next: max(boardMembersTable.ordering) })
      .from(boardMembersTable)
      .where(eq(boardMembersTable.boardId, boardId));

    const groundingDocumentId = await findGlobalGroundingForPreset(preset.slug);

    const [m] = await db
      .insert(boardMembersTable)
      .values({
        boardId,
        name: preset.name,
        roleTitle: preset.roleTitle,
        lensDescription: preset.lensDescription,
        instructionsText: preset.instructionsText,
        groundingDocumentId,
        fromPresetSlug: preset.slug,
        ordering: ((next as number | null) ?? -1) + 1,
      })
      .returning();

    res.status(201).json(serializeMember(m));
  },
);

router.post(
  "/boards/:boardId/seat-template",
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

    const parsed = apiOps.SeatBoardTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const template = findBoardTemplate(parsed.data.templateSlug);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const presets = template.presetSlugs
      .map((s) => findPreset(s))
      .filter((p): p is AdvisorPreset => Boolean(p));

    if (parsed.data.replaceExisting) {
      await db
        .delete(boardMembersTable)
        .where(eq(boardMembersTable.boardId, boardId));
    }

    const [{ next }] = await db
      .select({ next: max(boardMembersTable.ordering) })
      .from(boardMembersTable)
      .where(eq(boardMembersTable.boardId, boardId));
    let ordering = ((next as number | null) ?? -1) + 1;

    const inserted: (typeof boardMembersTable.$inferSelect)[] = [];
    for (const preset of presets) {
      const groundingDocumentId = await findGlobalGroundingForPreset(
        preset.slug,
      );
      const [m] = await db
        .insert(boardMembersTable)
        .values({
          boardId,
          name: preset.name,
          roleTitle: preset.roleTitle,
          lensDescription: preset.lensDescription,
          instructionsText: preset.instructionsText,
          groundingDocumentId,
          fromPresetSlug: preset.slug,
          ordering: ordering++,
        })
        .returning();
      inserted.push(m);
    }

    res.status(201).json(inserted.map(serializeMember));
  },
);

export default router;
