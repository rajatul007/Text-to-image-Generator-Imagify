import type { GenerationJob } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { logger, recordError } from "../logger";
import { notify } from "../notifications";
import { templates } from "../email/templates";
import { getProvider } from "../ai/registry";
import { getStyle } from "../ai/styles";
import { ProviderError, type ProviderResult } from "../ai/providers/types";
import { storage } from "../storage";
import { deleteStoredImage, storeImage, type StoredImage } from "../images/process";
import { refundJob } from "./create";

export const BACKOFF_MS = [0, 5_000, 20_000, 60_000];

export function backoffFor(attempt: number) {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

type Requeue = (jobId: string, delayMs: number) => void;

/**
 * Processes a single job end-to-end. Safe to call concurrently: the QUEUED→PROCESSING transition is an
 * atomic conditional update, so only one worker can claim a job.
 */
export async function processJob(jobId: string, workerId = `pid-${process.pid}`, requeue?: Requeue): Promise<void> {
  const now = new Date();
  const claimed = await db.generationJob.updateMany({
    where: { id: jobId, status: "QUEUED", nextRunAt: { lte: now } },
    data: { status: "PROCESSING", lockedAt: now, lockedBy: workerId, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;
  const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId }, include: { model: true, sourceImage: true } });
  if (!job.startedAt) await db.generationJob.update({ where: { id: jobId }, data: { startedAt: now } });

  let stored: StoredImage[] = [];
  try {
    const provider = getProvider(job.provider);
    if (!provider || !provider.isConfigured()) throw new ProviderError("auth", "The image service is not available at the moment.", `provider ${job.provider} not configured`);
    const signal = AbortSignal.timeout(env().IMAGE_PROVIDER_TIMEOUT_MS);
    let result: ProviderResult;
    if (job.type === "GENERATE") {
      if (!provider.generate) throw new ProviderError("invalid_request", "This model cannot generate images.");
      result = await provider.generate({
        model: job.model,
        prompt: job.finalPrompt,
        negativePrompt: job.negativePrompt,
        aspectRatio: job.aspectRatio ?? "1:1",
        quality: job.quality,
        numImages: job.numImages,
        seed: job.seed,
        style: getStyle(job.style),
        signal,
      });
    } else {
      if (!provider.edit) throw new ProviderError("invalid_request", "This model cannot edit images.");
      if (!job.sourceImage || job.sourceImage.deletedAt) throw new ProviderError("invalid_request", "The source image no longer exists.");
      const source = await storage().get(job.sourceImage.storageKey);
      result = await provider.edit({
        model: job.model,
        type: job.type,
        image: source,
        mimeType: job.sourceImage.mimeType,
        width: job.sourceImage.width,
        height: job.sourceImage.height,
        prompt: job.finalPrompt,
        negativePrompt: job.negativePrompt,
        seed: job.seed,
        numImages: job.numImages,
        strength: (job.params as { strength?: number | null }).strength ?? undefined,
        signal,
      });
    }
    if (result.images.length === 0) throw new ProviderError("transient", "The image service returned no images.");

    await db.generationJob.update({ where: { id: jobId }, data: { status: "UPLOADING" } });
    for (const img of result.images) stored.push(await storeImage(job.userId, img.data));

    const root = job.sourceImageId ? await resolveRoot(job.sourceImageId) : null;
    const prefs = await db.profile.findUnique({ where: { userId: job.userId }, select: { defaultShowPrompt: true, defaultShowCreator: true } });
    await db.$transaction(async (tx) => {
      let version = root ? await tx.imageVersion.count({ where: { rootImageId: root } }) : 0;
      for (let i = 0; i < stored.length; i++) {
        const s = stored[i];
        const image = await tx.generatedImage.create({
          data: {
            userId: job.userId,
            jobId: job.id,
            parentId: job.sourceImageId,
            origin: job.type === "GENERATE" ? "GENERATED" : "EDITED",
            ...s,
            seed: result.images[i].seed ?? (job.seed != null ? job.seed + i : null),
            prompt: job.type === "GENERATE" ? (job.enhancedPrompt ?? job.prompt) : (job.sourceImage?.prompt ?? job.prompt),
            style: job.style ?? job.sourceImage?.style ?? null,
            modelId: job.modelId,
            showPrompt: prefs?.defaultShowPrompt ?? true,
            showCreator: prefs?.defaultShowCreator ?? true,
          },
        });
        if (root) {
          version += 1;
          await tx.imageVersion.create({
            data: { imageId: image.id, rootImageId: root, parentImageId: job.sourceImageId, versionNumber: version, operation: job.type, instruction: job.type === "EDIT" ? job.prompt : null },
          });
        }
      }
      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          modelVersion: result.modelVersion,
          providerCostUsd: result.costUsd ?? null,
          lockedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
    });
    stored = [];
    void notify({
      userId: job.userId,
      type: "GENERATION_COMPLETE",
      title: job.type === "GENERATE" ? "Your images are ready" : "Your edit is ready",
      body: `${result.images.length} new image${result.images.length === 1 ? "" : "s"} added to your creations.`,
      link: job.type === "GENERATE" ? `/history?job=${job.id}` : `/editor/${job.sourceImageId}`,
      email: {
        pref: "emailGenerationComplete",
        template: "generationComplete",
        build: (name, url) => templates.generationComplete(name, result.images.length, `${url}/creations`),
      },
    });
  } catch (err) {
    for (const s of stored) await deleteStoredImage(s);
    const pe =
      err instanceof ProviderError ? err : new ProviderError("unknown", "Something went wrong while generating. Your credits have been refunded.", (err as Error)?.message);
    const fresh = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (pe.retryable && fresh.attempts < fresh.maxAttempts) {
      const delay = backoffFor(fresh.attempts);
      await db.generationJob.updateMany({
        where: { id: jobId, status: { in: ["PROCESSING", "UPLOADING"] } },
        data: { status: "QUEUED", nextRunAt: new Date(Date.now() + delay), lockedAt: null, lockedBy: null, errorCode: pe.kind, errorMessage: pe.userMessage },
      });
      logger.warn("job attempt failed, will retry", { jobId, attempt: fresh.attempts, kind: pe.kind, error: pe.message });
      requeue?.(jobId, delay);
    } else {
      await failJob(fresh, pe.kind, pe.userMessage);
      if (pe.kind === "unknown" || pe.kind === "auth") await recordError("job-processor", err, { jobId, provider: job.provider }, job.userId);
      else logger.warn("job failed", { jobId, kind: pe.kind, error: pe.message });
    }
  }
}

async function resolveRoot(imageId: string): Promise<string> {
  const v = await db.imageVersion.findUnique({ where: { imageId } });
  return v?.rootImageId ?? imageId;
}

/** Marks a job FAILED (if still in-flight) and refunds its credits exactly once. */
export async function failJob(job: Pick<GenerationJob, "id" | "userId" | "creditsCharged" | "type">, code: string, message: string) {
  const res = await db.generationJob.updateMany({
    where: { id: job.id, status: { in: ["QUEUED", "PROCESSING", "UPLOADING"] } },
    data: { status: "FAILED", errorCode: code, errorMessage: message, completedAt: new Date(), lockedAt: null },
  });
  if (res.count === 0) return;
  const refund = await refundJob(job, message);
  void notify({
    userId: job.userId,
    type: "GENERATION_FAILED",
    title: "Generation failed",
    body: `${message}${refund && !refund.duplicate ? ` ${job.creditsCharged} credits were refunded.` : ""}`,
    link: `/history?job=${job.id}`,
    email: { pref: "emailGenerationFailed", template: "generationFailed", build: (name, url) => templates.generationFailed(name, job.creditsCharged, `${url}/history`) },
  });
}

/**
 * Recovers jobs whose worker died mid-flight (lock older than provider timeout + grace).
 * They are re-queued if attempts remain, otherwise failed and refunded.
 */
export async function recoverStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - env().IMAGE_PROVIDER_TIMEOUT_MS - 60_000);
  const stale = await db.generationJob.findMany({ where: { status: { in: ["PROCESSING", "UPLOADING"] }, lockedAt: { lt: cutoff } }, take: 50 });
  for (const job of stale) {
    if (job.attempts < job.maxAttempts) {
      await db.generationJob.updateMany({
        where: { id: job.id, status: { in: ["PROCESSING", "UPLOADING"] }, lockedAt: { lt: cutoff } },
        data: { status: "QUEUED", lockedAt: null, lockedBy: null, nextRunAt: new Date(), errorCode: "timeout", errorMessage: "Previous attempt timed out" },
      });
    } else {
      await failJob(job, "timeout", "The image service took too long to respond. Your credits have been refunded.");
    }
  }
  return stale.length;
}
