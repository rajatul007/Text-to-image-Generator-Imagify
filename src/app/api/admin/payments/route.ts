import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route({ auth: "admin" }, async ({ query }) => {
  const input = query(z.object({ status: z.enum(["CREATED", "PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(), q: z.string().max(80).optional(), page: z.coerce.number().int().min(1).default(1) }));
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q ? { OR: [{ id: input.q }, { receipt: { contains: input.q } }, { razorpayOrderId: input.q }, { razorpayPaymentId: input.q }, { user: { email: { contains: input.q } } }] } : {}),
  };
  const [total, orders] = await Promise.all([
    db.paymentOrder.count({ where }),
    db.paymentOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * 30, take: 30, include: { user: { select: { email: true } }, refunds: true } }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 30)), items: orders };
});
