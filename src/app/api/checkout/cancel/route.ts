import { z } from "zod";
import { route } from "@/lib/api";
import { cancelCheckout } from "@/lib/payments/orders";

export const POST = route({}, async ({ user, json }) => {
  const { orderId } = await json(z.object({ orderId: z.string().min(1).max(64) }));
  const order = await cancelCheckout(user.id, orderId);
  return { status: order?.status ?? null };
});
