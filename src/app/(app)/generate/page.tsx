import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { hoursAgo } from "@/lib/time";
import { listModels } from "@/lib/ai/registry";
import { ASPECT_RATIOS, STYLES } from "@/lib/ai/styles";
import { llmConfigured } from "@/lib/ai/llm";
import { getBalance } from "@/lib/credits/ledger";
import { serializeJob } from "@/lib/queries/jobs";
import { Generator, type GeneratorDefaults } from "@/components/generate/generator";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Generate" };

type SP = Promise<Record<string, string | undefined>>;

export default async function GeneratePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requirePageUser("/generate");
  const [models, balance, recent] = await Promise.all([
    listModels("TEXT_TO_IMAGE"),
    getBalance(user.id),
    db.generationJob.findMany({
      where: { userId: user.id, type: "GENERATE", createdAt: { gte: hoursAgo(6) } },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { images: true, model: { select: { displayName: true } } },
    }),
  ]);

  const defaults: GeneratorDefaults = {
    prompt: sp.prompt?.slice(0, 2000),
    style: sp.style && STYLES.some((s) => s.id === sp.style) ? sp.style : null,
    aspectRatio: sp.aspectRatio,
    modelId: sp.model,
  };
  // "Reuse settings" from history/creations
  if (sp.fromJob) {
    const job = await db.generationJob.findFirst({ where: { id: sp.fromJob, userId: user.id } });
    if (job) {
      Object.assign(defaults, {
        prompt: job.prompt,
        enhancedPrompt: job.enhancedPrompt,
        negativePrompt: (job.params as { userNegativePrompt?: string }).userNegativePrompt ?? "",
        style: job.style,
        aspectRatio: job.aspectRatio ?? undefined,
        modelId: job.modelId,
        numImages: job.numImages,
        quality: job.quality,
        seed: job.seed,
      } satisfies GeneratorDefaults);
    }
  }
  if (sp.seed && /^\d{1,10}$/.test(sp.seed)) defaults.seed = Number(sp.seed);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Generate" description="Describe an image, refine the prompt, and choose how it should be made." />
      <Generator
        models={models}
        styles={STYLES.map(({ id, label, swatch }) => ({ id, label, swatch }))}
        aspectRatios={ASPECT_RATIOS}
        balance={balance}
        verified={Boolean(user.emailVerified)}
        enhancerAvailable={llmConfigured()}
        defaults={defaults}
        recentJobs={recent.map(serializeJob)}
      />
    </div>
  );
}
