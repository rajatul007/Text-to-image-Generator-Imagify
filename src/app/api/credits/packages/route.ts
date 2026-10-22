import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { razorpayConfigured, isTestMode } from "@/lib/payments/razorpay";

export const GET = route({ auth: "none" }, async () => {
  const [packages, plans] = await Promise.all([
    db.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    paymentsEnabled: razorpayConfigured(),
    testMode: isTestMode(),
    packages: packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, credits: p.credits, pricePaise: p.pricePaise, currency: p.currency, highlight: p.highlight })),
    plans: plans.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, monthlyCredits: p.monthlyCredits, pricePaise: p.pricePaise, features: p.features, available: Boolean(p.razorpayPlanId) })),
  };
});
