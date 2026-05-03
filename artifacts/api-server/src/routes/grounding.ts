import { Router, type IRouter, type Request, type Response } from "express";
import { db, groundingDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { apiOps, RegisterGroundingDocumentBody } from "@workspace/api-zod";
import { requireTenantRole } from "../lib/tenantAuth";
import { extractTextFromObject } from "../lib/textExtract";
const router: IRouter = Router();

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];

function serialize(d: typeof groundingDocumentsTable.$inferSelect) {
  return {
    id: d.id,
    tenantId: d.tenantId,
    filename: d.filename,
    contentType: d.contentType,
    storagePath: d.storagePath,
    characterCount: d.characterCount,
    truncated: d.truncated,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

router.get("/grounding-documents", async (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;
  if (!tenantId) {
    res.status(400).json({ error: "tenantId query param is required" });
    return;
  }
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;

  const docs = await db
    .select()
    .from(groundingDocumentsTable)
    .where(eq(groundingDocumentsTable.tenantId, tenantId))
    .orderBy(groundingDocumentsTable.uploadedAt);

  res.json(docs.map(serialize));
});

router.post("/grounding-documents", async (req: Request, res: Response) => {
  const parsed = apiOps.RegisterGroundingDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const ctx = await requireTenantRole(req, res, parsed.data.tenantId, "EDITOR");
  if (!ctx) return;

  if (parsed.data.size > MAX_BYTES) {
    res.status(400).json({ error: "File exceeds 20 MB limit" });
    return;
  }
  const ct = parsed.data.contentType.toLowerCase();
  if (
    !ALLOWED.some((t) => ct.startsWith(t)) &&
    !ct.startsWith("text/")
  ) {
    res.status(400).json({ error: `Unsupported content type: ${ct}` });
    return;
  }

  let extracted = { text: "", characterCount: 0, truncated: false };
  try {
    extracted = await extractTextFromObject(
      parsed.data.objectPath,
      parsed.data.contentType,
    );
  } catch (err) {
    req.log.warn({ err }, "Text extraction failed; storing empty text");
  }

  const [doc] = await db
    .insert(groundingDocumentsTable)
    .values({
      tenantId: parsed.data.tenantId,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      storagePath: parsed.data.objectPath,
      extractedText: extracted.text,
      characterCount: extracted.characterCount,
      truncated: extracted.truncated,
      uploadedBy: ctx.userId,
    })
    .returning();

  res.status(201).json(serialize(doc));
});

router.get(
  "/grounding-documents/:documentId",
  async (req: Request, res: Response) => {
    const id = req.params.documentId as string;
    const [doc] = await db
      .select()
      .from(groundingDocumentsTable)
      .where(eq(groundingDocumentsTable.id, id))
      .limit(1);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, doc.tenantId, "VIEWER");
    if (!ctx) return;
    res.json(serialize(doc));
  },
);

router.delete(
  "/grounding-documents/:documentId",
  async (req: Request, res: Response) => {
    const id = req.params.documentId as string;
    const [doc] = await db
      .select()
      .from(groundingDocumentsTable)
      .where(eq(groundingDocumentsTable.id, id))
      .limit(1);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const ctx = await requireTenantRole(req, res, doc.tenantId, "EDITOR");
    if (!ctx) return;

    await db
      .delete(groundingDocumentsTable)
      .where(
        and(
          eq(groundingDocumentsTable.id, id),
          eq(groundingDocumentsTable.tenantId, doc.tenantId),
        ),
      );

    res.json({ success: true });
  },
);

export default router;
