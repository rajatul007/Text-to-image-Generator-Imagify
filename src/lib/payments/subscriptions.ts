import type { SubscriptionStatus } from "@prisma/client";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { applyCreditChange } from "../credits/ledger";
import { notify } from "../notifications";
import { razorpay, razorpayKeyId, verifySubscriptionSignature, type RzpSubscription } from "./razorpay";

const LIVE: SubscriptionStatus[] = ["CREATED", "AUTHENTICATED", "ACTIVE", "PENDING", "HALTED"];

export async function getActiveSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { userId, status: { in: LIVE } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Starts a Razorpay subscription for a plan configured with a Razorpay plan id. */
export async function startSubscription(user: { id: string; name: string; email: string }, planIdOrSlug: string) {
  const plan = await db.subscriptionPlan.findFirst({ where: { OR: [{ id: planIdOrSlug }, { slug: planIdOrSlug }], active: true } });
  if (!plan) throw notFound("Plan");
  if (!plan.razorpayPlanId) throw new AppError("NOT_CONFIGURED", "This plan is not yet available for recurring billing.");
  const existing = await getActiveSubscription(user.id);
  if (existing && existing.status !== "CREATED") throw new AppError("CONFLICT", "You already have a subscription. Change or cancel it from the Credits page.");
  if (existing?.status === "CREATED") await db.subscription.update({ where: { id: existing.id }, data: { status: "EXPIRED" } });
  const sub = await razorpay.createSubscription({ plan_id: plan.razorpayPlanId, total_count: 120, customer_notify: 1, notes: { userId: user.id, planId: plan.id } });
  await db.subscription.create({ data: { userId: user.id, planId: plan.id, razorpaySubscriptionId: sub.id, status: "CREATED" } });
  return { keyId: razorpayKeyId(), subscriptionId: sub.id, name: "Text to Image Generator", description: `${plan.name} – ${plan.monthlyCredits} credits / month`, prefill: { name: user.name, email: user.email } };
}

export async function verifySubscriptionCheckout(userId: string, input: { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const sub = await db.subscription.findFirst({ where: { razorpaySubscriptionId: input.razorpay_subscription_id, userId } });
  if (!sub) throw notFound("Subscription");
  if (!verifySubscriptionSignature(input.razorpay_subscription_id, input.razorpay_payment_id, input.razorpay_signature)) {
    throw new AppError("BAD_REQUEST", "Subscription verification failed.");
  }
  const remote = await razorpay.fetchSubscription(sub.razorpaySubscriptionId);
  await syncSubscription(remote);
  // Monthly credits are allocated by the `subscription.charged` webhook (server-to-server, signed).
  return db.subscription.findUniqueOrThrow({ where: { id: sub.id }, include: { plan: true } });
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  created: "CREATED",
  authenticated: "AUTHENTICATED",
  active: "ACTIVE",
  pending: "PENDING",
  halted: "HALTED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  expired: "EXPIRED",
};

export async function syncSubscription(remote: RzpSubscription) {
  const sub = await db.subscription.findUnique({ where: { razorpaySubscriptionId: remote.id } });
  if (!sub) return null;
  const plan = await db.subscriptionPlan.findFirst({ where: { razorpayPlanId: remote.plan_id } });
  const status = STATUS_MAP[remote.status] ?? sub.status;
  return db.subscription.update({
    where: { id: sub.id },
    data: {
      status,
      planId: plan?.id ?? sub.planId,
      pendingPlanId: plan && sub.pendingPlanId === plan.id ? null : sub.pendingPlanId,
      currentPeriodStart: remote.current_start ? new Date(remote.current_start * 1000) : sub.currentPeriodStart,
      currentPeriodEnd: remote.current_end ? new Date(remote.current_end * 1000) : sub.currentPeriodEnd,
      ...(status === "PENDING" || status === "HALTED" ? { lastPaymentFailedAt: new Date() } : {}),
    },
  });
}

/** Allocates the monthly credits for one billing period – exactly once per subscription period. */
export async function allocateSubscriptionCredits(remote: RzpSubscription, paymentId: string) {
  const sub = await syncSubscription(remote);
  if (!sub) return null;
  const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { id: sub.planId } });
  const period = remote.current_start ?? Math.floor(Date.now() / 1000);
  const result = await applyCreditChange({
    userId: sub.userId,
    amount: plan.monthlyCredits,
    type: "SUBSCRIPTION_ALLOCATION",
    idempotencyKey: `sub-alloc:${sub.razorpaySubscriptionId}:${period}`,
    description: `${plan.name} monthly allocation – ${plan.monthlyCredits} credits`,
    subscriptionId: sub.id,
    metadata: { razorpayPaymentId: paymentId, periodStart: period },
  });
  if (!result.duplicate) {
    void notify({ userId: sub.userId, type: "SUBSCRIPTION_CREDITS", title: "Monthly credits added", body: `${plan.monthlyCredits} credits from your ${plan.name} plan were added.`, link: "/transactions" });
  }
  return result;
}

export async function cancelSubscription(userId: string) {
  const sub = await getActiveSubscription(userId);
  if (!sub) throw notFound("Active subscription");
  const remote = await razorpay.cancelSubscription(sub.razorpaySubscriptionId, true);
  await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  await syncSubscription(remote);
  return db.subscription.findUniqueOrThrow({ where: { id: sub.id }, include: { plan: true } });
}

/** Upgrade/downgrade – takes effect at the end of the current billing cycle. */
export async function changeSubscriptionPlan(userId: string, planIdOrSlug: string) {
  const sub = await getActiveSubscription(userId);
  if (!sub || sub.status !== "ACTIVE") throw new AppError("CONFLICT", "You need an active subscription to change plans.");
  const plan = await db.subscriptionPlan.findFirst({ where: { OR: [{ id: planIdOrSlug }, { slug: planIdOrSlug }], active: true } });
  if (!plan?.razorpayPlanId) throw notFound("Plan");
  if (plan.id === sub.planId) throw new AppError("CONFLICT", "You are already on this plan.");
  await razorpay.updateSubscription(sub.razorpaySubscriptionId, plan.razorpayPlanId);
  return db.subscription.update({ where: { id: sub.id }, data: { pendingPlanId: plan.id }, include: { plan: true } });
}

export async function notifySubscriptionProblem(remote: RzpSubscription) {
  const sub = await db.subscription.findUnique({ where: { razorpaySubscriptionId: remote.id } });
  if (!sub) return;
  void notify({
    userId: sub.userId,
    type: "SUBSCRIPTION_PAYMENT_FAILED",
    title: "Subscription payment failed",
    body: "We couldn't renew your subscription. Please update your payment method to keep receiving monthly credits.",
    link: "/credits",
  });
}
