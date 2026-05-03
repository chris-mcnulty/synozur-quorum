import { Router, type IRouter, type Request, type Response } from "express";
import { db, tenantsTable, tenantMembersTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { apiOps, CreateTenantBody, InviteTenantMemberBody } from "@workspace/api-zod";
import { requireUser, requireTenantRole } from "../lib/tenantAuth";

const router: IRouter = Router();

router.get("/tenants", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const rows = await db
    .select({
      tenant: tenantsTable,
      role: tenantMembersTable.role,
      joinedAt: tenantMembersTable.joinedAt,
    })
    .from(tenantMembersTable)
    .innerJoin(tenantsTable, eq(tenantMembersTable.tenantId, tenantsTable.id))
    .where(eq(tenantMembersTable.userId, userId))
    .orderBy(tenantsTable.createdAt);

  res.json(
    rows.map((r) => ({
      tenant: {
        id: r.tenant.id,
        name: r.tenant.name,
        slug: r.tenant.slug,
        createdAt: r.tenant.createdAt.toISOString(),
      },
      role: r.role,
      joinedAt: r.joinedAt.toISOString(),
    })),
  );
});

router.post("/tenants", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const parsed = apiOps.CreateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ name: parsed.data.name, slug: parsed.data.slug })
      .returning();

    await db
      .insert(tenantMembersTable)
      .values({ tenantId: tenant.id, userId, role: "OWNER" });

    res.status(201).json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create tenant");
    res.status(409).json({ error: "Slug already exists" });
  }
});

router.get(
  "/tenants/:tenantId/members",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
    if (!ctx) return;

    const rows = await db
      .select({
        userId: tenantMembersTable.userId,
        role: tenantMembersTable.role,
        joinedAt: tenantMembersTable.joinedAt,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        displayName: usersTable.displayName,
      })
      .from(tenantMembersTable)
      .innerJoin(usersTable, eq(tenantMembersTable.userId, usersTable.id))
      .where(eq(tenantMembersTable.tenantId, tenantId));

    res.json(
      rows.map((r) => ({
        userId: r.userId,
        email: r.email,
        displayName:
          r.displayName ||
          [r.firstName, r.lastName].filter(Boolean).join(" ") ||
          null,
        role: r.role,
        joinedAt: r.joinedAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/tenants/:tenantId/members",
  async (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
    if (!ctx) return;

    const parsed = apiOps.InviteTenantMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, parsed.data.email))
      .limit(1);
    if (!user) {
      res.status(404).json({
        error: "User not found. They must sign in once before being invited.",
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(tenantMembersTable)
      .where(
        and(
          eq(tenantMembersTable.tenantId, tenantId),
          eq(tenantMembersTable.userId, user.id),
        ),
      )
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(tenantMembersTable)
        .set({ role: parsed.data.role })
        .where(
          and(
            eq(tenantMembersTable.tenantId, tenantId),
            eq(tenantMembersTable.userId, user.id),
          ),
        )
        .returning();
    } else {
      [row] = await db
        .insert(tenantMembersTable)
        .values({
          tenantId,
          userId: user.id,
          role: parsed.data.role,
        })
        .returning();
    }

    res.status(201).json({
      userId: row.userId,
      email: user.email,
      displayName:
        user.displayName ||
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        null,
      role: row.role,
      joinedAt: row.joinedAt.toISOString(),
    });
  },
);

export default router;
