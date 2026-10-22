import { z } from "zod";
import { route } from "@/lib/api";
import { changeSubscriptionPlan } from "@/lib/payments/subscriptions";

export const POST = route({}, async ({ user, json }) => {
  const { planId } = await json(z.object({ planId: z.string().min(1).max(60) }));
  const sub = await changeSubscriptionPlan(user.id, planId);
  return { pendingPlanId: sub.pendingPlanId, message: "Your plan will change at the start of the next billing cycle." };
});
