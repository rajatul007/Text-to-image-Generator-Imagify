import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route({ auth: "admin" }, async ({ query }) => {
  const q = query(z.object({ kind: z.enum(["errors", "audit", "email"]).default("errors"), page: z.coerce.number().int().min(1).default(1) }));
  const skip = (q.page - 1) * 50;
  if (q.kind === "audit") return { items: await db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, skip, take: 50, include: { admin: { select: { email: true } } } }) };
  if (q.kind === "email") return { items: await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, skip, take: 50, omit: { devBody: true } }) };
  return { items: await db.errorLog.findMany({ orderBy: { createdAt: "desc" }, skip, take: 50 }) };
});
