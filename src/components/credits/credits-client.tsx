"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Coins } from "lucide-react";
import { Button } from "../ui/button";
import { Alert, Badge, Panel } from "../ui/misc";
import { useConfirm } from "../ui/dialog";
import { loadRazorpay, openRazorpay, type RazorpayResponse } from "./razorpay";
import { api } from "@/lib/client/api";
import { cn, formatDate, formatInr } from "@/lib/utils";

interface Pkg {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  credits: number;
  pricePaise: number;
  highlight: boolean;
}
interface Plan {
  id: string;
  slug: string;
  name: string;
  monthlyCredits: number;
  pricePaise: number;
  features: string[];
  available: boolean;
}
interface Sub {
  status: string;
  planId: string;
  planName: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanName: string | null;
}

interface CheckoutResponse {
  orderId: string;
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
}

export function CreditsClient({ packages, plans, subscription, paymentsEnabled, testMode, verified }: { packages: Pkg[]; plans: Plan[]; subscription: Sub | null; paymentsEnabled: boolean; testMode: boolean; verified: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const highlighted = sp.get("package") ?? sp.get("plan");
  const scrolled = useRef(false);

  useEffect(() => {
    if (highlighted && !scrolled.current) {
      scrolled.current = true;
      document.getElementById(`opt-${highlighted}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const buy = async (pkg: Pkg) => {
    setBusy(pkg.id);
    try {
      const [order] = await Promise.all([api<CheckoutResponse>("/api/checkout", { body: { packageId: pkg.id } }), loadRazorpay()]);
      openRazorpay(
        {
          key: order.keyId,
          order_id: order.razorpayOrderId,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          prefill: order.prefill,
          handler: async (r: RazorpayResponse) => {
            // Credits are added only after the server verifies the signature AND the payment status with Razorpay.
            try {
              await api("/api/checkout/verify", { body: r });
            } catch (e) {
              toast.error((e as Error).message);
            }
            router.push(`/checkout/success?order=${order.orderId}`);
          },
          modal: {
            ondismiss: () => {
              setBusy(null);
              void api("/api/checkout/cancel", { body: { orderId: order.orderId } })
                .then((res) => {
                  if ((res as { status?: string }).status === "CANCELLED") router.push(`/checkout/cancel?order=${order.orderId}`);
                })
                .catch(() => undefined);
            },
          },
        },
        (msg) => toast.error(`Payment failed: ${msg}`),
      );
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  const subscribe = async (plan: Plan) => {
    setBusy(plan.id);
    try {
      const [res] = await Promise.all([api<{ keyId: string; subscriptionId: string; name: string; description: string; prefill: { name: string; email: string } }>("/api/subscriptions", { body: { planId: plan.id } }), loadRazorpay()]);
      openRazorpay(
        {
          key: res.keyId,
          subscription_id: res.subscriptionId,
          name: res.name,
          description: res.description,
          prefill: res.prefill,
          handler: async (r) => {
            try {
              await api("/api/subscriptions/verify", { body: r });
              toast.success("Subscription started. Monthly credits are added as soon as Razorpay confirms the charge.");
            } catch (e) {
              toast.error((e as Error).message);
            }
            setBusy(null);
            router.refresh();
          },
          modal: { ondismiss: () => setBusy(null) },
        },
        (msg) => toast.error(`Payment failed: ${msg}`),
      );
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  const changePlan = async (plan: Plan) => {
    if (!(await confirm({ title: `Switch to ${plan.name}?`, description: "The change takes effect at the start of your next billing cycle.", confirmLabel: "Switch plan" }))) return;
    setBusy(plan.id);
    try {
      const res = await api<{ message: string }>("/api/subscriptions/change", { body: { planId: plan.id } });
      toast.success(res.message);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!(await confirm({ title: "Cancel subscription?", description: "It stays active until the end of the current billing period, and your credits remain usable.", confirmLabel: "Cancel subscription", cancelLabel: "Keep subscription", danger: true }))) return;
    setBusy("cancel");
    try {
      await api("/api/subscriptions/cancel", { method: "POST" });
      toast.success("Subscription will end at the close of this billing period");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const disabledReason = !paymentsEnabled ? "Payments aren't configured on this server yet." : !verified ? "Verify your email to buy credits." : null;

  return (
    <div className="space-y-10">
      {disabledReason && <Alert tone="warn">{disabledReason}</Alert>}
      {paymentsEnabled && testMode && (
        <Alert tone="violet" title="Test mode">
          Razorpay is using test keys – no real money moves. Use Razorpay&apos;s test cards or UPI ID success@razorpay.
        </Alert>
      )}

      <section aria-labelledby="buy-heading">
        <h2 id="buy-heading" className="font-display mb-4 text-xl font-semibold">
          Buy credits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {packages.map((p) => (
            <Panel key={p.id} id={`opt-${p.slug}`} className={cn("flex flex-col p-5", (p.highlight || highlighted === p.slug) && "border-violet/70", highlighted === p.slug && "ring-2 ring-violet/40")}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                {p.highlight && <Badge tone="violet">Popular</Badge>}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Coins className="size-4" /> {p.credits.toLocaleString("en-IN")} credits
              </p>
              <div className="mt-4 font-display text-3xl font-semibold">{formatInr(p.pricePaise)}</div>
              <p className="text-xs text-faint">{formatInr(Math.round(p.pricePaise / p.credits))} per credit</p>
              <Button className="mt-5" variant={p.highlight ? "primary" : "secondary"} onClick={() => buy(p)} loading={busy === p.id} disabled={Boolean(disabledReason) || (busy !== null && busy !== p.id)}>
                Buy for {formatInr(p.pricePaise)}
              </Button>
            </Panel>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">Secure checkout by Razorpay – UPI, cards, net banking and wallets as enabled. We never see or store your card details or UPI PIN.</p>
      </section>

      <section aria-labelledby="sub-heading">
        <h2 id="sub-heading" className="font-display mb-1 text-xl font-semibold">
          Monthly plans
        </h2>
        <p className="mb-4 text-sm text-muted">Fresh credits every billing cycle. Unused credits roll over and never expire.</p>
        {subscription && (
          <Panel className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">
                {subscription.planName} <Badge tone={subscription.status === "ACTIVE" ? "ok" : subscription.status === "HALTED" || subscription.status === "PENDING" ? "danger" : "neutral"}>{subscription.status.toLowerCase()}</Badge>
              </p>
              <p className="text-muted">
                {subscription.status === "PENDING" || subscription.status === "HALTED"
                  ? "Your last renewal failed. Razorpay will retry – update your payment method from the Razorpay email."
                  : subscription.currentPeriodEnd
                    ? `${subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} on ${formatDate(subscription.currentPeriodEnd)}`
                    : "Waiting for Razorpay to confirm your first payment."}
                {subscription.pendingPlanName && ` · Switching to ${subscription.pendingPlanName} next cycle`}
              </p>
            </div>
            {!subscription.cancelAtPeriodEnd && ["ACTIVE", "AUTHENTICATED", "PENDING", "HALTED"].includes(subscription.status) && (
              <Button variant="danger" size="sm" onClick={cancel} loading={busy === "cancel"}>
                Cancel subscription
              </Button>
            )}
          </Panel>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = subscription?.planId === p.id;
            return (
              <Panel key={p.id} id={`opt-${p.slug}`} className={cn("flex flex-col p-5", current && "border-violet/70", highlighted === p.slug && "ring-2 ring-violet/40")}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                  {current && <Badge tone="violet">Current plan</Badge>}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-semibold">{formatInr(p.pricePaise)}</span>
                  <span className="text-sm text-muted">/ month</span>
                </div>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {f}
                    </li>
                  ))}
                </ul>
                {!p.available ? (
                  <Button variant="secondary" className="mt-5" disabled>
                    Not yet available
                  </Button>
                ) : current ? (
                  <Button variant="secondary" className="mt-5" disabled>
                    Your current plan
                  </Button>
                ) : subscription?.status === "ACTIVE" ? (
                  <Button variant="secondary" className="mt-5" onClick={() => changePlan(p)} loading={busy === p.id} disabled={Boolean(disabledReason)}>
                    {p.pricePaise > (plans.find((x) => x.id === subscription.planId)?.pricePaise ?? 0) ? "Upgrade" : "Downgrade"} to {p.name}
                  </Button>
                ) : (
                  <Button className="mt-5" onClick={() => subscribe(p)} loading={busy === p.id} disabled={Boolean(disabledReason) || Boolean(subscription && subscription.status !== "CREATED")}>
                    Subscribe
                  </Button>
                )}
              </Panel>
            );
          })}
        </div>
      </section>
    </div>
  );
}
