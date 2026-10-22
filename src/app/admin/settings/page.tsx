import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isModelAvailable } from "@/lib/ai/registry";
import { Announcements, ModelsTable, PackagesTable, PlansTable, SettingsForm } from "@/components/admin/config-panels";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Configuration" };
export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const [settings, models, packages, plans, announcements] = await Promise.all([
    getSettings(),
    db.aiModel.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    db.creditPackage.findMany({ orderBy: { sortOrder: "asc" } }),
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.announcement.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Configuration" description="Credits, pricing, models and announcements. Every change is recorded in the audit log." />
      <SettingsForm initial={settings} />
      <ModelsTable models={models.map((m) => ({ id: m.id, displayName: m.displayName, provider: m.provider, kind: m.kind, enabled: m.enabled, available: isModelAvailable({ ...m, enabled: true }), creditsPerImage: m.creditsPerImage, hdMultiplier: m.hdMultiplier, maxImages: m.maxImages, estimatedCostUsd: Number(m.estimatedCostUsd), modelVersion: m.modelVersion }))} />
      <PackagesTable packages={packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, credits: p.credits, pricePaise: p.pricePaise, active: p.active, highlight: p.highlight, sortOrder: p.sortOrder }))} />
      <PlansTable plans={plans.map((p) => ({ id: p.id, name: p.name, monthlyCredits: p.monthlyCredits, pricePaise: p.pricePaise, razorpayPlanId: p.razorpayPlanId, active: p.active }))} />
      <Announcements items={announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, level: a.level, active: a.active }))} />
    </div>
  );
}
