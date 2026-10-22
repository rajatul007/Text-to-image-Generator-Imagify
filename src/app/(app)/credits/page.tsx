import { Suspense } from "react";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { walletSummary } from "@/lib/queries/credits";
import { getActiveSubscription } from "@/lib/payments/subscriptions";
import { isTestMode, razorpayConfigured } from "@/lib/payments/razorpay";
import { getSettings } from "@/lib/settings";
import { CreditsClient } from "@/components/credits/credits-client";
import { PageHeader, Stat } from "@/components/ui/misc";

export const metadata = { title: "Credits & Pricing" };

export default async function CreditsPage() {
  const user = await requirePageUser("/credits");
  const [wallet, packages, plans, sub, settings] = await Promise.all([
    walletSummary(user.id),
    db.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getActiveSubscription(user.id),
    getSettings(),
  ]);
  const pending = sub?.pendingPlanId ? plans.find((p) => p.id === sub.pendingPlanId)?.name ?? null : null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Credits & Pricing"
        description={
          <>
            Every action shows its credit cost before you start. See the{" "}
            <Link href="/pricing" className="text-violet underline">
              cost per model
            </Link>
            .
          </>
        }
      />
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Available balance" value={wallet.balance.toLocaleString("en-IN")} hint={wallet.balance < settings.lowCreditThreshold ? "Running low" : undefined} className="col-span-2 lg:col-span-1" />
        <Stat label="Purchased" value={wallet.lifetimePurchased.toLocaleString("en-IN")} hint="Packs & subscriptions" />
        <Stat label="Promotional" value={wallet.lifetimePromo.toLocaleString("en-IN")} hint="Welcome & rewards" />
        <Stat label="Spent" value={wallet.lifetimeSpent.toLocaleString("en-IN")} />
        <Stat label="Refunded" value={wallet.lifetimeRefunded.toLocaleString("en-IN")} hint="Failed or cancelled jobs" />
      </div>
      <Suspense>
        <CreditsClient
          packages={packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, credits: p.credits, pricePaise: p.pricePaise, highlight: p.highlight }))}
          plans={plans.map((p) => ({ id: p.id, slug: p.slug, name: p.name, monthlyCredits: p.monthlyCredits, pricePaise: p.pricePaise, features: p.features, available: Boolean(p.razorpayPlanId) }))}
          subscription={sub ? { status: sub.status, planId: sub.planId, planName: sub.plan.name, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, pendingPlanName: pending } : null}
          paymentsEnabled={razorpayConfigured()}
          testMode={isTestMode()}
          verified={Boolean(user.emailVerified)}
        />
      </Suspense>
    </div>
  );
}
