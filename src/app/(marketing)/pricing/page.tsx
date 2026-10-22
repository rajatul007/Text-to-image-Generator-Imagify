import Link from "next/link";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PricingCards } from "@/components/home/pricing-cards";
import { Faq } from "@/components/home/faq";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { formatInr } from "@/lib/utils";

export const metadata = { title: "Pricing", description: "Credit packs and monthly plans for Text to Image Generator, priced in INR." };
export const dynamic = "force-dynamic";

const KIND_LABEL = { TEXT_TO_IMAGE: "Generate", IMAGE_EDIT: "Edit with text", VARIATION: "Variations", UPSCALE: "Upscale", REMOVE_BACKGROUND: "Remove background" } as const;

export default async function PricingPage() {
  const [packages, plans, models, settings] = await Promise.all([
    db.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.aiModel.findMany({ where: { enabled: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    getSettings(),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Simple, credit-based pricing</h1>
        <p className="mt-3 text-muted">
          Every account starts on the free tier with {settings.welcomeCredits} credits after email verification. Buy credit packs when you need them, or subscribe for a monthly allowance. Prices are in INR and include applicable taxes.
        </p>
      </header>

      <section aria-labelledby="packs">
        <h2 id="packs" className="font-display mb-6 text-2xl font-semibold">
          One-time credit packs
        </h2>
        <PricingCards packages={packages} />
      </section>

      <section aria-labelledby="plans">
        <h2 id="plans" className="font-display text-2xl font-semibold">
          Monthly plans
        </h2>
        <p className="mt-1 text-sm text-muted">Credits are added on every successful renewal and roll over. Cancel anytime – you keep access until the end of the billing period.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[var(--radius-panel)] border border-line bg-panel p-5">
            <h3 className="font-display text-lg font-semibold">Free</h3>
            <div className="mt-3 font-display text-3xl font-semibold">₹0</div>
            <ul className="mt-4 space-y-2 text-sm">
              {[`${settings.welcomeCredits} welcome credits`, "All models and styles", "Private gallery & sharing", "Top up with credit packs"].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" className="mt-6 w-full">
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
          {plans.map((p) => (
            <div key={p.id} className="rounded-[var(--radius-panel)] border border-line bg-panel p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                {!p.razorpayPlanId && <Badge>Coming soon</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-semibold">{formatInr(p.pricePaise)}</span>
                <span className="text-sm text-muted">/ month</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {f}
                  </li>
                ))}
              </ul>
              {p.razorpayPlanId ? (
                <Button asChild variant="secondary" className="mt-6 w-full">
                  <Link href={`/credits?plan=${p.slug}`}>Subscribe to {p.name}</Link>
                </Button>
              ) : (
                <Button variant="secondary" className="mt-6 w-full" disabled>
                  Not yet available
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="costs">
        <h2 id="costs" className="font-display text-2xl font-semibold">
          What things cost
        </h2>
        <p className="mt-1 text-sm text-muted">Cost is calculated on the server before each request and shown before you start. Failed generations are refunded automatically.</p>
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-panel)] border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Use</th>
                <th className="px-4 py-3 font-medium">Seed control</th>
                <th className="px-4 py-3 text-right font-medium">Credits per image</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {models.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">{m.displayName}</td>
                  <td className="px-4 py-3 text-muted">{KIND_LABEL[m.kind]}</td>
                  <td className="px-4 py-3 text-muted">{m.supportsSeed ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {m.creditsPerImage}
                    {m.qualities.includes("hd") && <span className="text-faint"> · HD ×{m.hdMultiplier}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-4xl">
        <h2 className="font-display mb-6 text-2xl font-semibold">Billing questions</h2>
        <Faq />
      </section>
    </div>
  );
}
