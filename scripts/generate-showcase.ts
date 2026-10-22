/**
 * Fills the homepage/Explore gallery with REAL generated images using your configured provider.
 * Creates (or reuses) a verified "Showcase" account, grants it credits through the ledger
 * (as an audited admin adjustment is not possible from a script, a PROMOTIONAL entry is used), generates
 * the featured prompt templates and publishes the results.
 *
 *   JOB_RUNNER=worker npx tsx scripts/generate-showcase.ts [modelId] [count]
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { createUser } from "../src/lib/auth/accounts";
import { applyCreditChange } from "../src/lib/credits/ledger";
import { processJob } from "../src/lib/jobs/processor";
import { isModelAvailable } from "../src/lib/ai/registry";
import { SEED_TEMPLATES } from "../src/data/prompt-templates";
import { randomUUID } from "node:crypto";

process.env.JOB_RUNNER = "worker"; // process synchronously below instead of dispatching

async function main() {
  const modelId = process.argv[2] ?? "flux-schnell";
  const count = Number(process.argv[3] ?? 8);
  const model = await db.aiModel.findUnique({ where: { id: modelId } });
  if (!model || !isModelAvailable(model)) throw new Error(`Model ${modelId} is not available – configure its provider API key first.`);
  const { createGenerationJob } = await import("../src/lib/jobs/create");

  const email = "showcase@pixelforge.local";
  const user = (await db.user.findUnique({ where: { email } })) ?? (await createUser({ name: "Showcase", email, emailVerified: true }));
  const templates = SEED_TEMPLATES.filter((t) => t.featured).slice(0, count);
  await applyCreditChange({ userId: user.id, amount: model.creditsPerImage * templates.length, type: "PROMOTIONAL", idempotencyKey: `showcase:${randomUUID()}`, description: "Showcase generation budget" });

  for (const t of templates) {
    const ratio = model.aspectRatios.includes(t.aspectRatio) ? t.aspectRatio : model.aspectRatios[0];
    const { job } = await createGenerationJob(user.id, { modelId, prompt: t.prompt, style: t.style, aspectRatio: ratio, quality: "standard", numImages: 1, idempotencyKey: randomUUID() });
    await processJob(job.id, "showcase-script");
    const done = await db.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    if (done.status !== "COMPLETED") {
      console.warn(`✗ ${t.title}: ${done.errorMessage}`);
      continue;
    }
    await db.generatedImage.updateMany({ where: { jobId: job.id }, data: { visibility: "PUBLIC", publishedAt: new Date() } });
    console.log(`✓ ${t.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
