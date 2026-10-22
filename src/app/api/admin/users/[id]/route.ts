import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { adminUserDetail } from "@/lib/queries/admin-users";

export const GET = route({ auth: "admin" }, async ({ params }) => {
  const detail = await adminUserDetail(params.id);
  if (!detail) throw notFound("User");
  return detail;
});

const patchSchema = z.object({
  action: z.enum(["suspend", "reactivate"]),
  reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(500),
});

export const PATCH = route({ auth: "admin" }, async ({ user: admin, params, json, ip }) => {
  const { action, reason } = await json(patchSchema);
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target || target.status === "DELETED") throw notFound("User");
  if (target.id === admin.id) throw new AppError("BAD_REQUEST", "You can't change your own account status");
  if (target.role === "ADMIN" && action === "suspend") throw new AppError("FORBIDDEN", "Demote the administrator before suspending them");
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: target.id },
      data: action === "suspend" ? { status: "SUSPENDED", suspendedAt: new Date(), suspendReason: reason } : { status: "ACTIVE", suspendedAt: null, suspendReason: null },
    });
    if (action === "suspend") await tx.session.deleteMany({ where: { userId: target.id } });
    await audit(admin.id, action === "suspend" ? "user.suspend" : "user.reactivate", { type: "User", id: target.id }, { reason, email: target.email }, ip, tx);
    return u;
  });
  return { status: updated.status };
});
