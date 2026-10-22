import type { GenerationJob, JobType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db, isUniqueViolation } from "../db";
import { AppError, notFound } from "../errors";
import { randomSeed } from "../crypto";
import { applyCreditChange, applyCreditChangeTx } from "../credits/ledger";
import { generationCost } from "../credits/pricing";
import { getSettings } from "../settings";
import { maybeNotifyLowCredits } from "../notifications";
import { assertPromptAllowed } from "../ai/moderation";
import { isModelAvailable } from "../ai/registry";
import { applyStyle, getStyle, STYLE_IDS } from "../ai/styles";
import { dispatchJob } from "./runner";

export const MAX_SEED = 2_147_483_647;

export const generateInputSchema = z.object({
  modelId: z.string().min(1),
  prompt: z.string().trim().min(3, "Prompt must be at least 3 characters").max(2000, "Prompt is too long (max 2000 characters)"),
  enhancedPrompt: z.string().trim().max(2000).optional().nullable(),
  negativePrompt: z.string().trim().max(1000).optional().nullable(),
  style: z.enum(STYLE_IDS).optional().nullable(),
  aspectRatio: z.string().min(3).max(6),
  quality: z.enum(["standard", "hd"]).default("standard"),
  numImages: z.number().int().min(1).max(8).default(1),
  seed: z.number().int().min(0).max(MAX_SEED).optional().nullable(),
  idempotencyKey: z.string().min(8).max(100),
  retryOfId: z.string().optional().nullable(),
});
export type GenerateInput = z.infer<typeof generateInputSchema>;

export const editInputSchema = z.object({
  sourceImageId: z.string().min(1),
  type: z.enum(["EDIT", "VARIATION", "UPSCALE", "REMOVE_BACKGROUND"]),
  modelId: z.string().min(1),
  prompt: z.string().trim().max(2000).optional().nullable(),
  negativePrompt: z.string().trim().max(1000).optional().nullable(),
  numImages: z.number().int().min(1).max(4).default(1),
  strength: z.number().min(0.05).max(1).optional().nullable(),
  seed: z.number().int().min(0).max(MAX_SEED).optional().nullable(),
  idempotencyKey: z.string().min(8).max(100),
});
export type EditInput = z.infer<typeof editInputSchema>;

const KIND_FOR: Record<Exclude<JobType, "GENERATE">, string> = {
  EDIT: "IMAGE_EDIT",
  VARIATION: "VARIATION",
  UPSCALE: "UPSCALE",
  REMOVE_BACKGROUND: "REMOVE_BACKGROUND",
};

async function assertCapacity(userId: string) {
  const { maxActiveJobsPerUser } = await getSettings();
  const active = await db.generationJob.count({ where: { userId, status: { in: ["QUEUED", "PROCESSING", "UPLOADING"] } } });
  if (active >= maxActiveJobsPerUser) {
    throw new AppError("RATE_LIMITED", `You already have ${active} generation${active === 1 ? "" : "s"} in progress. Please wait for one to finish.`);
  }
}

/** Creates the job and charges credits in ONE transaction; duplicate idempotency keys return the original job. */
async function createChargedJob(userId: string, idempotencyKey: string, data: Omit<Prisma.GenerationJobUncheckedCreateInput, "userId" | "idempotencyKey">, description: string) {
  const existing = await db.generationJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
  if (existing) return { job: existing, duplicate: true, balanceBefore: null as number | null, balanceAfter: null as number | null };
  try {
    const result = await db.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.findUnique({ where: { userId } });
      const job = await tx.generationJob.create({ data: { ...data, userId, idempotencyKey } });
      const charge = await applyCreditChangeTx(tx, {
        userId,
        amount: -data.creditsCharged,
        type: "GENERATION_CHARGE",
        idempotencyKey: `charge:job:${job.id}`,
        description,
        jobId: job.id,
      });
      return { job, balanceBefore: wallet?.balance ?? 0, balanceAfter: charge.balanceAfter };
    });
    return { ...result, duplicate: false };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const job = await db.generationJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
      if (job) return { job, duplicate: true, balanceBefore: null, balanceAfter: null };
    }
    throw err;
  }
}

export async function createGenerationJob(userId: string, input: GenerateInput): Promise<{ job: GenerationJob; duplicate: boolean }> {
  const model = await db.aiModel.findUnique({ where: { id: input.modelId } });
  if (!model || model.kind !== "TEXT_TO_IMAGE") throw new AppError("VALIDATION", "Unknown image model");
  if (!isModelAvailable(model)) throw new AppError("PROVIDER_UNAVAILABLE", `${model.displayName} is currently unavailable. Your prompt has been kept – try another model.`);
  if (!model.aspectRatios.includes(input.aspectRatio)) throw new AppError("VALIDATION", `${model.displayName} does not support the ${input.aspectRatio} aspect ratio`);
  if (input.seed != null && !model.supportsSeed) throw new AppError("VALIDATION", `${model.displayName} does not support seed control`);

  const basePrompt = (input.enhancedPrompt || input.prompt).trim();
  await assertPromptAllowed(basePrompt, input.negativePrompt);
  const cost = generationCost({ model, numImages: input.numImages, quality: input.quality });
  await assertCapacity(userId);

  const style = getStyle(input.style);
  const seed = model.supportsSeed ? (input.seed ?? randomSeed()) : null;
  const negative = model.supportsNegativePrompt ? [input.negativePrompt, style?.negative].filter(Boolean).join(", ") || null : null;

  const { job, duplicate, balanceBefore, balanceAfter } = await createChargedJob(
    userId,
    input.idempotencyKey,
    {
      type: "GENERATE",
      modelId: model.id,
      provider: model.provider,
      modelVersion: model.modelVersion,
      prompt: input.prompt,
      enhancedPrompt: input.enhancedPrompt || null,
      finalPrompt: applyStyle(basePrompt, style),
      negativePrompt: negative,
      style: style?.id ?? null,
      aspectRatio: input.aspectRatio,
      quality: input.quality,
      numImages: input.numImages,
      seed,
      params: { userNegativePrompt: input.negativePrompt ?? null, seedRequested: input.seed ?? null },
      creditsCharged: cost,
      retryOfId: input.retryOfId ?? null,
    },
    `Generation – ${input.numImages} image${input.numImages > 1 ? "s" : ""} with ${model.displayName}`,
  );
  if (!duplicate) {
    if (balanceBefore != null && balanceAfter != null) void maybeNotifyLowCredits(userId, balanceBefore, balanceAfter);
    dispatchJob(job.id);
  }
  return { job, duplicate };
}

export async function createEditJob(userId: string, input: EditInput): Promise<{ job: GenerationJob; duplicate: boolean }> {
  const source = await db.generatedImage.findFirst({ where: { id: input.sourceImageId, userId, deletedAt: null } });
  if (!source) throw notFound("Image");
  const model = await db.aiModel.findUnique({ where: { id: input.modelId } });
  if (!model || model.kind !== KIND_FOR[input.type]) throw new AppError("VALIDATION", "This model can't perform that edit");
  if (!isModelAvailable(model)) throw new AppError("PROVIDER_UNAVAILABLE", `${model.displayName} is currently unavailable.`);
  if (input.type === "EDIT" && !input.prompt) throw new AppError("VALIDATION", "Describe the change you want to make");
  const numImages = input.type === "VARIATION" || input.type === "EDIT" ? Math.min(input.numImages, model.maxImages) : 1;
  const instruction = input.prompt?.trim() || (input.type === "VARIATION" ? source.prompt : null);
  await assertPromptAllowed(instruction, input.negativePrompt);
  await assertCapacity(userId);
  const cost = generationCost({ model, numImages, quality: "standard" });
  const seed = model.supportsSeed ? (input.seed ?? randomSeed()) : null;
  const labels: Record<EditInput["type"], string> = { EDIT: "Image edit", VARIATION: "Variations", UPSCALE: "Upscale", REMOVE_BACKGROUND: "Background removal" };

  const { job, duplicate, balanceBefore, balanceAfter } = await createChargedJob(
    userId,
    input.idempotencyKey,
    {
      type: input.type,
      modelId: model.id,
      provider: model.provider,
      modelVersion: model.modelVersion,
      prompt: input.prompt?.trim() || labels[input.type],
      finalPrompt: instruction ?? labels[input.type],
      negativePrompt: input.negativePrompt || null,
      numImages,
      seed,
      sourceImageId: source.id,
      width: source.width,
      height: source.height,
      params: { strength: input.strength ?? null },
      creditsCharged: cost,
    },
    `${labels[input.type]} with ${model.displayName}`,
  );
  if (!duplicate) {
    if (balanceBefore != null && balanceAfter != null) void maybeNotifyLowCredits(userId, balanceBefore, balanceAfter);
    dispatchJob(job.id);
  }
  return { job, duplicate };
}

/** Cancels a job that has not started yet and refunds its credits exactly once. */
export async function cancelJob(userId: string, jobId: string) {
  const job = await db.generationJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw notFound("Generation");
  const res = await db.generationJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), errorMessage: "Cancelled by user" },
  });
  if (res.count === 0) throw new AppError("CONFLICT", "This generation has already started and can no longer be cancelled.");
  await refundJob(job, "Cancelled before processing");
  return db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
}

export async function refundJob(job: Pick<GenerationJob, "id" | "userId" | "creditsCharged">, reason: string) {
  if (job.creditsCharged <= 0) return null;
  return applyCreditChange({
    userId: job.userId,
    amount: job.creditsCharged,
    type: "REFUND",
    idempotencyKey: `refund:job:${job.id}`,
    description: `Refund – ${reason}`,
    reason,
    jobId: job.id,
  });
}
