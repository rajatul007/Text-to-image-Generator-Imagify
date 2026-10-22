import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route({}, async ({ user, query }) => {
  const q = query(z.object({ unread: z.enum(["1", "0"]).optional(), page: z.coerce.number().int().min(1).max(1000).default(1) }));
  const where = { userId: user.id, ...(q.unread === "1" ? { readAt: null } : {}) };
  const [total, unread, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * 30, take: 30 }),
  ]);
  return { total, unread, pages: Math.max(1, Math.ceil(total / 30)), items };
});
