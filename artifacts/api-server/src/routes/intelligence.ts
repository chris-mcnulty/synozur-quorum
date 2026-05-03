import { Router, type IRouter, type Request, type Response } from "express";
import { db, boardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  backfillTopicsForTenant,
  getBoardIntelligence,
  getTenantIntelligence,
} from "../lib/intelligence";

const router: IRouter = Router();

router.get(
  "/tenants/:tenantId/intelligence",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;
    const data = await getTenantIntelligence(tenantId);
    res.json(data);
  },
);

router.post(
  "/tenants/:tenantId/intelligence/backfill-topics",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "EDITOR");
    if (!ctx) return;
    const limitRaw = Number(req.body?.limit ?? 5);
    const limit = Math.max(1, Math.min(20, Number.isFinite(limitRaw) ? limitRaw : 5));
    const result = await backfillTopicsForTenant(tenantId, limit);
    res.json(result);
  },
);

router.get(
  "/boards/:boardId/intelligence",
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
    const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
    if (!ctx) return;
    const data = await getBoardIntelligence(boardId);
    res.json(data);
  },
);

export default router;
