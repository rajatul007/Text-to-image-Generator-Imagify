import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { serializeJob } from "@/lib/queries/jobs";

const q = z.object({
  status: z.enum(["QUEUED", "PROCESSING", "UPLOADING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  provider: z.string().max(30).optional(),
  userId: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const GET = route({ auth: "admin" }, async ({ query }) => {
  const input = query(q);
  const where: Prisma.GenerationJobWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
  };
  const [total, jobs] = await Promise.all([
    db.generationJob.count({ where }),
    db.generationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * 30, take: 30, include: { images: true, model: { select: { displayName: true } }, user: { select: { email: true } } } }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 30)), items: jobs.map((j) => ({ ...serializeJob(j), userEmail: j.user.email, userId: j.userId, providerCostUsd: j.providerCostUsd ? Number(j.providerCostUsd) : null })) };
});
