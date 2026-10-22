import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = route({}, async ({ user, json }) => {
  const input = await json(z.object({ ids: z.array(z.string()).max(100).optional(), all: z.boolean().optional() }));
  const res = await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(input.all ? {} : { id: { in: input.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
});
