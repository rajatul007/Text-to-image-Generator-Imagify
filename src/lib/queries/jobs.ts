import type { GeneratedImage, GenerationJob, JobStatus, JobType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { imageUrls } from "../images/access";

export const historyQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["QUEUED", "PROCESSING", "UPLOADING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  type: z.enum(["GENERATE", "VARIATION", "EDIT", "UPSCALE", "REMOVE_BACKGROUND"]).optional(),
  model: z.string().max(60).optional(),
  style: z.string().max(40).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export function serializeJob(job: GenerationJob & { images?: GeneratedImage[]; model?: { displayName: string } | null }) {
  return {
    id: job.id,
    type: job.type as JobType,
    status: job.status as JobStatus,
    modelId: job.modelId,
    modelName: job.model?.displayName ?? job.modelId,
    modelVersion: job.modelVersion,
    provider: job.provider,
    prompt: job.prompt,
    enhancedPrompt: job.enhancedPrompt,
    finalPrompt: job.finalPrompt,
    negativePrompt: job.negativePrompt,
    userNegativePrompt: (job.params as { userNegativePrompt?: string | null })?.userNegativePrompt ?? null,
    style: job.style,
    aspectRatio: job.aspectRatio,
    quality: job.quality,
    numImages: job.numImages,
    seed: job.seed,
    sourceImageId: job.sourceImageId,
    creditsCharged: job.creditsCharged,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    nextRunAt: job.nextRunAt.toISOString(),
    images: (job.images ?? [])
      .filter((i) => !i.deletedAt)
      .map((i) => ({ id: i.id, ...imageUrls(i.id), width: i.width, height: i.height, seed: i.seed, visibility: i.visibility })),
  };
}
export type SerializedJob = ReturnType<typeof serializeJob>;

export async function listJobs(userId: string, q: HistoryQuery) {
  const where: Prisma.GenerationJobWhereInput = {
    userId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.model ? { modelId: q.model } : {}),
    ...(q.style ? { style: q.style } : {}),
    ...(q.q ? { OR: [{ prompt: { contains: q.q, mode: "insensitive" } }, { enhancedPrompt: { contains: q.q, mode: "insensitive" } }] } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86_400_000) } : {}) } }
      : {}),
  };
  const [total, jobs] = await Promise.all([
    db.generationJob.count({ where }),
    db.generationJob.findMany({
      where,
      orderBy: { createdAt: q.sort === "oldest" ? "asc" : "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { images: { orderBy: { createdAt: "asc" } }, model: { select: { displayName: true } } },
    }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)), items: jobs.map(serializeJob) };
}
