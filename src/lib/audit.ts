import type { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";

export async function audit(
  adminId: string,
  action: string,
  target: { type: string; id?: string | null },
  details: Prisma.InputJsonValue = {},
  ip?: string,
  tx: Tx | typeof db = db,
) {
  await tx.adminAuditLog.create({ data: { adminId, action, targetType: target.type, targetId: target.id ?? null, details, ip } });
}
