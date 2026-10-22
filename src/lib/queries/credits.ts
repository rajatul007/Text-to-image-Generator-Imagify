import type { CreditTxType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";

export const ledgerQuerySchema = z.object({
  type: z.enum(["PURCHASE", "GENERATION_CHARGE", "REFUND", "WELCOME_BONUS", "PROMOTIONAL", "SUBSCRIPTION_ALLOCATION", "ADMIN_ADJUSTMENT", "PAYMENT_REVERSAL"]).optional(),
  q: z.string().trim().max(100).optional(),
  direction: z.enum(["in", "out"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

export const TX_LABELS: Record<CreditTxType, string> = {
  PURCHASE: "Credit purchase",
  GENERATION_CHARGE: "Image generation",
  REFUND: "Refund",
  WELCOME_BONUS: "Welcome bonus",
  PROMOTIONAL: "Promotional reward",
  SUBSCRIPTION_ALLOCATION: "Subscription credits",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  PAYMENT_REVERSAL: "Payment refund reversal",
};

export async function listLedger(userId: string, q: LedgerQuery) {
  const where: Prisma.CreditTransactionWhereInput = {
    userId,
    ...(q.type ? { type: q.type } : {}),
    ...(q.direction === "in" ? { amount: { gt: 0 } } : q.direction === "out" ? { amount: { lt: 0 } } : {}),
    ...(q.q ? { OR: [{ id: { contains: q.q } }, { description: { contains: q.q, mode: "insensitive" } }, { jobId: q.q }, { paymentOrderId: q.q }] } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86_400_000) } : {}) } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.creditTransaction.count({ where }),
    db.creditTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { paymentOrder: { select: { id: true, amountPaise: true, status: true, receipt: true, packageName: true } } },
    }),
  ]);
  return {
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
    items: rows.map((t) => ({
      id: t.id,
      type: t.type,
      typeLabel: TX_LABELS[t.type],
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      reason: t.reason,
      jobId: t.jobId,
      createdAt: t.createdAt.toISOString(),
      order: t.paymentOrder ? { id: t.paymentOrder.id, amountPaise: t.paymentOrder.amountPaise, status: t.paymentOrder.status, receipt: t.paymentOrder.receipt, packageName: t.paymentOrder.packageName } : null,
    })),
  };
}

export async function walletSummary(userId: string) {
  const wallet = await db.creditWallet.findUnique({ where: { userId } });
  return {
    balance: wallet?.balance ?? 0,
    lifetimePurchased: wallet?.lifetimePurchased ?? 0,
    lifetimePromo: wallet?.lifetimePromo ?? 0,
    lifetimeSpent: wallet?.lifetimeSpent ?? 0,
    lifetimeRefunded: wallet?.lifetimeRefunded ?? 0,
  };
}
