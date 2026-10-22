import "dotenv/config";
import { db } from "../src/lib/db";
import { SEED_MODELS, SEED_PACKAGES, SEED_PLANS } from "../src/data/seed-models";
import { SEED_TEMPLATES } from "../src/data/prompt-templates";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

/** Idempotent seed: safe to run repeatedly; never overwrites values an admin has edited. */
async function main() {
  for (const m of SEED_MODELS) {
    await db.aiModel.upsert({ where: { id: m.id }, create: m, update: {} });
  }
  for (const p of SEED_PACKAGES) {
    await db.creditPackage.upsert({ where: { slug: p.slug }, create: p, update: {} });
  }
  for (const p of SEED_PLANS) {
    await db.subscriptionPlan.upsert({
      where: { slug: p.slug },
      create: p,
      update: p.razorpayPlanId ? { razorpayPlanId: p.razorpayPlanId } : {},
    });
  }
  const count = await db.promptTemplate.count({ where: { authorId: null } });
  if (count === 0) {
    await db.promptTemplate.createMany({
      data: SEED_TEMPLATES.map((t, i) => ({ ...t, featured: t.featured ?? false, usageCount: Math.max(0, 60 - i * 2), createdAt: new Date(Date.now() - i * 3_600_000) })),
    });
  }
  await db.appSetting.upsert({ where: { key: "app" }, create: { key: "app", value: DEFAULT_SETTINGS }, update: {} });
  console.log(`Seeded ${SEED_MODELS.length} models, ${SEED_PACKAGES.length} packages, ${SEED_PLANS.length} plans, ${SEED_TEMPLATES.length} prompt templates.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
