import { route } from "@/lib/api";
import { cancelSubscription } from "@/lib/payments/subscriptions";

export const POST = route({}, async ({ user }) => {
  const sub = await cancelSubscription(user.id);
  return { status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null };
});
