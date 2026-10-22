import { z } from "zod";
import { route } from "@/lib/api";
import { RULES } from "@/lib/rate-limit";
import { createCheckout } from "@/lib/payments/orders";

export const POST = route({ verified: true, rateLimit: RULES.checkout }, async ({ user, json }) => {
  const { packageId } = await json(z.object({ packageId: z.string().min(1).max(60) }));
  return createCheckout(user, packageId);
});
