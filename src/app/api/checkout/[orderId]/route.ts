import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { getBalance } from "@/lib/credits/ledger";

export const GET = route({}, async ({ user, params }) => {
  const order = await db.paymentOrder.findFirst({ where: { id: params.orderId, userId: user.id } });
  if (!order) throw notFound("Order");
  return {
    order: { id: order.id, status: order.status, credits: order.credits, amountPaise: order.amountPaise, packageName: order.packageName, receipt: order.receipt, paidAt: order.paidAt?.toISOString() ?? null, failureReason: order.failureReason },
    balance: await getBalance(user.id),
  };
});
