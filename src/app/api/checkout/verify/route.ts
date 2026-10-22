import { z } from "zod";
import { route } from "@/lib/api";
import { verifyCheckout } from "@/lib/payments/orders";

const schema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

export const POST = route({}, async ({ user, json }) => verifyCheckout(user.id, await json(schema)));
