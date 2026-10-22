import { z } from "zod";
import { route } from "@/lib/api";
import { RULES } from "@/lib/rate-limit";
import { getActiveSubscription, startSubscription } from "@/lib/payments/subscriptions";

export const GET = route({}, async ({ user }) => {
  const sub = await getActiveSubscription(user.id);
  return {
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          plan: { id: sub.plan.id, name: sub.plan.name, monthlyCredits: sub.plan.monthlyCredits, pricePaise: sub.plan.pricePaise },
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          pendingPlanId: sub.pendingPlanId,
        }
      : null,
  };
});

export const POST = route({ verified: true, rateLimit: RULES.checkout }, async ({ user, json }) => {
  const { planId } = await json(z.object({ planId: z.string().min(1).max(60) }));
  return startSubscription(user, planId);
});
