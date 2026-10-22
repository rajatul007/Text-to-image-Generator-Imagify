import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { razorpay } from "@/lib/payments/razorpay";
import { recordRefund } from "@/lib/payments/orders";

/** Issues a (partial) refund through Razorpay and records it. The refund webhook is idempotent with this. */
export const POST = route({ auth: "admin" }, async ({ user: admin, params, json, ip }) => {
  const input = await json(z.object({ amountPaise: z.number().int().positive(), reason: z.string().trim().min(5).max(300) }));
  const order = await db.paymentOrder.findUnique({ where: { id: params.id } });
  if (!order || !order.razorpayPaymentId) throw notFound("Paid order");
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) throw new AppError("CONFLICT", "Only paid orders can be refunded");
  if (input.amountPaise > order.amountPaise - order.refundedPaise) throw new AppError("VALIDATION", "Refund exceeds the refundable amount");
  const refund = await razorpay.refundPayment(order.razorpayPaymentId, input.amountPaise, { reason: input.reason, orderId: order.id });
  await recordRefund({ id: refund.id, payment_id: refund.payment_id, amount: refund.amount, status: refund.status });
  await audit(admin.id, "payment.refund", { type: "PaymentOrder", id: order.id }, { amountPaise: input.amountPaise, reason: input.reason, refundId: refund.id }, ip);
  return { ok: true, refundId: refund.id };
});
