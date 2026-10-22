import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { promptTemplateSchema } from "@/lib/admin-schemas";

export const GET = route({ auth: "admin" }, async ({ query }) => {
  const q = query(z.object({ q: z.string().max(80).optional(), status: z.enum(["PUBLISHED", "PENDING", "ARCHIVED"]).optional(), page: z.coerce.number().int().min(1).default(1) }));
  const where = { ...(q.status ? { status: q.status } : {}), ...(q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" as const } }, { prompt: { contains: q.q, mode: "insensitive" as const } }] } : {}) };
  const [total, items] = await Promise.all([
    db.promptTemplate.count({ where }),
    db.promptTemplate.findMany({ where, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], skip: (q.page - 1) * 50, take: 50, include: { author: { select: { email: true } } } }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 50)), items };
});

export const POST = route({ auth: "admin" }, async ({ user, json, ip }) => {
  const data = await json(promptTemplateSchema);
  const t = await db.promptTemplate.create({ data });
  await audit(user.id, "prompt.create", { type: "PromptTemplate", id: t.id }, { title: t.title }, ip);
  return { template: t };
});
