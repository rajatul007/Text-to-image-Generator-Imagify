import { z } from "zod";
import { route } from "@/lib/api";
import { verifySubscriptionCheckout } from "@/lib/payments/subscriptions";

export const POST = route({}, async ({ user, json }) => {
  const input = await json(z.object({ razorpay_subscription_id: z.string().min(5).max(64), razorpay_payment_id: z.string().min(5).max(64), razorpay_signature: z.string().min(10).max(256) }));
  const sub = await verifySubscriptionCheckout(user.id, input);
  return { status: sub.status, plan: sub.plan.name };
});
