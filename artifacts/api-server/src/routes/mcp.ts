import { Router, type IRouter, type Request, type Response } from "express";
import { db, mcpApiKeysTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireTenantRole } from "../lib/tenantAuth";
import { generateApiKey, mcpServer } from "../lib/mcp";

const router: IRouter = Router();

const SCOPES = [
  "boards:read",
  "boards:write",
  "sessions:read",
  "sessions:write",
  "decisions:read",
  "decisions:write",
] as const;

// ─── MCP transports ───────────────────────────────────────────────────
router.post("/mcp", mcpServer.streamableHttp);
router.get("/mcp", mcpServer.httpDescriptor);
router.get("/mcp/sse", mcpServer.sseConnect);
router.post("/mcp/messages", mcpServer.ssePost);

// Public capability descriptor (no auth) for health + manifest sniffing.
router.get("/mcp/.well-known", (_req, res) => {
  res.json(mcpServer.descriptor());
});

// ─── API key management (browser session auth) ────────────────────────
const CreateKeyBody = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(SCOPES)).min(1),
});

router.get(
  "/tenants/:tenantId/mcp-keys",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
    if (!ctx) return;
    const rows = await db
      .select()
      .from(mcpApiKeysTable)
      .where(eq(mcpApiKeysTable.tenantId, tenantId))
      .orderBy(desc(mcpApiKeysTable.createdAt));
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        keyPrefix: r.keyPrefix,
        scopes: r.scopes ?? [],
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
        revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      })),
    );
  },
);

router.post(
  "/tenants/:tenantId/mcp-keys",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
    if (!ctx) return;
    const parsed = CreateKeyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
      return;
    }
    const { plaintext, hash, prefix } = generateApiKey();
    const [row] = await db
      .insert(mcpApiKeysTable)
      .values({
        tenantId,
        userId: ctx.userId,
        name: parsed.data.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: parsed.data.scopes,
      })
      .returning();
    res.status(201).json({
      id: row.id,
      name: row.name,
      scopes: row.scopes ?? [],
      keyPrefix: row.keyPrefix,
      plaintext, // only returned on creation
      createdAt: row.createdAt.toISOString(),
    });
  },
);

router.delete(
  "/tenants/:tenantId/mcp-keys/:keyId",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const keyId = req.params.keyId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
    if (!ctx) return;
    const [row] = await db
      .select()
      .from(mcpApiKeysTable)
      .where(
        and(eq(mcpApiKeysTable.id, keyId), eq(mcpApiKeysTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Key not found" });
      return;
    }
    await db
      .update(mcpApiKeysTable)
      .set({ revokedAt: new Date() })
      .where(eq(mcpApiKeysTable.id, keyId));
    res.status(204).end();
  },
);

export default router;
