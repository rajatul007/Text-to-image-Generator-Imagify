import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { RULES } from "@/lib/rate-limit";
import { createEditJob, createGenerationJob } from "@/lib/jobs/create";
import { serializeJob } from "@/lib/queries/jobs";
import { getBalance } from "@/lib/credits/ledger";

/** Re-runs a failed/cancelled/completed job with identical settings (including the same seed). */
export const POST = route({ verified: true, rateLimit: RULES.generate }, async ({ user, params, json }) => {
  const { idempotencyKey, newSeed } = await json(z.object({ idempotencyKey: z.string().min(8).max(100), newSeed: z.boolean().default(false) }));
  const prev = await db.generationJob.findFirst({ where: { id: params.id, userId: user.id } });
  if (!prev) throw notFound("Generation");
  if (["QUEUED", "PROCESSING", "UPLOADING"].includes(prev.status)) throw new AppError("CONFLICT", "This generation is still running");
  const params2 = prev.params as { userNegativePrompt?: string | null; strength?: number | null };
  const result =
    prev.type === "GENERATE"
      ? await createGenerationJob(user.id, {
          modelId: prev.modelId,
          prompt: prev.prompt,
          enhancedPrompt: prev.enhancedPrompt,
          negativePrompt: params2.userNegativePrompt ?? null,
          style: prev.style,
          aspectRatio: prev.aspectRatio ?? "1:1",
          quality: prev.quality as "standard" | "hd",
          numImages: prev.numImages,
          seed: newSeed ? null : prev.seed,
          idempotencyKey,
          retryOfId: prev.id,
        })
      : await createEditJob(user.id, {
          sourceImageId: prev.sourceImageId ?? "",
          type: prev.type,
          modelId: prev.modelId,
          prompt: prev.type === "EDIT" ? prev.prompt : null,
          negativePrompt: prev.negativePrompt,
          numImages: prev.numImages,
          strength: params2.strength ?? null,
          seed: newSeed ? null : prev.seed,
          idempotencyKey,
        });
  return { job: serializeJob(result.job), duplicate: result.duplicate, balance: await getBalance(user.id) };
});
