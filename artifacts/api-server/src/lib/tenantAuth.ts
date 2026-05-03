import { type Request, type Response } from "express";
import { db, tenantMembersTable, type TenantRole } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export type RequiredRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

const ROLE_RANK: Record<TenantRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export function requireUser(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

export async function getTenantRole(
  userId: string,
  tenantId: string,
): Promise<TenantRole | null> {
  const [row] = await db
    .select()
    .from(tenantMembersTable)
    .where(
      and(
        eq(tenantMembersTable.userId, userId),
        eq(tenantMembersTable.tenantId, tenantId),
      ),
    )
    .limit(1);
  return (row?.role as TenantRole | undefined) ?? null;
}

export async function requireTenantRole(
  req: Request,
  res: Response,
  tenantId: string,
  minRole: RequiredRole,
): Promise<{ userId: string; role: TenantRole } | null> {
  const userId = requireUser(req, res);
  if (!userId) return null;

  const role = await getTenantRole(userId, tenantId);
  if (!role) {
    res.status(403).json({ error: "Not a member of this tenant" });
    return null;
  }
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    res.status(403).json({ error: `Requires role ${minRole} or higher` });
    return null;
  }
  return { userId, role };
}
