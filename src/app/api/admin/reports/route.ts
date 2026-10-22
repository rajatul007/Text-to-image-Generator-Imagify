import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { imageUrls } from "@/lib/images/access";

export const GET = route({ auth: "admin" }, async ({ query }) => {
  const q = query(z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN"), page: z.coerce.number().int().min(1).default(1) }));
  const [total, items] = await Promise.all([
    db.contentReport.count({ where: { status: q.status } }),
    db.contentReport.findMany({
      where: { status: q.status },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * 30,
      take: 30,
      include: { image: { select: { id: true, prompt: true, moderationStatus: true, visibility: true, userId: true, user: { select: { email: true } } } }, reporter: { select: { email: true } } },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 30)), items: items.map((r) => ({ ...r, image: { ...r.image, ...imageUrls(r.image.id) } })) };
});
