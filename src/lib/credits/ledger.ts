import type { CreditTxType, Prisma } from "@prisma/client";
import { db, isUniqueViolation, type Tx } from "../db";
import { AppError } from "../errors";

export interface CreditChange {
  userId: string;
  /** Signed amount. Positive adds credits, negative deducts. */
  amount: number;
  type: CreditTxType;
  /** Globally unique key – the same key can never move credits twice. */
  idempotencyKey: string;
  description: string;
  reason?: string;
  jobId?: string;
  paymentOrderId?: string;
  subscriptionId?: string;
  adminId?: string;
  metadata?: Prisma.InputJsonValue;
  /** Allow a deduction to push the balance below zero? Never for charges; only for payment reversals (clamped at 0). */
  clampAtZero?: boolean;
}

export interface CreditResult {
  transactionId: string;
  balanceAfter: number;
  amount: number;
  duplicate: boolean;
}

const LIFETIME_FIELD: Partial<Record<CreditTxType, "lifetimePurchased" | "lifetimePromo" | "lifetimeSpent" | "lifetimeRefunded">> = {
  PURCHASE: "lifetimePurchased",
  SUBSCRIPTION_ALLOCATION: "lifetimePurchased",
  WELCOME_BONUS: "lifetimePromo",
  PROMOTIONAL: "lifetimePromo",
  GENERATION_CHARGE: "lifetimeSpent",
  REFUND: "lifetimeRefunded",
};

export async function ensureWallet(userId: string, tx: Tx | typeof db = db) {
  return tx.creditWallet.upsert({ where: { userId }, create: { userId }, update: {} });
}

/**
 * Applies a credit change inside an existing transaction.
 * - Balance update is a single conditional UPDATE, so concurrent charges can't overdraw.
 * - The ledger row's unique idempotency key guarantees each logical event is applied at most once.
 * Throws INSUFFICIENT_CREDITS when a deduction exceeds the balance.
 * Throws a unique violation (P2002) on duplicates – callers should use `applyCreditChange`, which handles it.
 */
export async function applyCreditChangeTx(tx: Tx, change: CreditChange): Promise<CreditResult> {
  if (!Number.isInteger(change.amount) || change.amount === 0) throw new AppError("BAD_REQUEST", "Credit amount must be a non-zero integer");

  const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey: change.idempotencyKey } });
  if (existing) return { transactionId: existing.id, balanceAfter: existing.balanceAfter, amount: existing.amount, duplicate: true };

  const wallet = await ensureWallet(change.userId, tx);
  let amount = change.amount;

  if (amount < 0 && change.clampAtZero) {
    const current = await tx.$queryRaw<{ balance: number }[]>`SELECT balance FROM "CreditWallet" WHERE id = ${wallet.id} FOR UPDATE`;
    amount = -Math.min(-amount, current[0]?.balance ?? 0);
    if (amount === 0) {
      const row = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId: change.userId,
          type: change.type,
          amount: 0,
          balanceAfter: current[0]?.balance ?? 0,
          idempotencyKey: change.idempotencyKey,
          description: change.description,
          reason: change.reason,
          jobId: change.jobId,
          paymentOrderId: change.paymentOrderId,
          subscriptionId: change.subscriptionId,
          adminId: change.adminId,
          metadata: change.metadata ?? {},
        },
      });
      return { transactionId: row.id, balanceAfter: row.balanceAfter, amount: 0, duplicate: false };
    }
  }

  const lifetime = LIFETIME_FIELD[change.type];
  const lifetimeDelta = Math.abs(amount);
  const rows = await tx.$queryRaw<{ balance: number }[]>`
    UPDATE "CreditWallet"
    SET balance = balance + ${amount},
        "lifetimePurchased" = "lifetimePurchased" + ${lifetime === "lifetimePurchased" ? lifetimeDelta : 0},
        "lifetimePromo" = "lifetimePromo" + ${lifetime === "lifetimePromo" ? lifetimeDelta : 0},
        "lifetimeSpent" = "lifetimeSpent" + ${lifetime === "lifetimeSpent" ? lifetimeDelta : 0},
        "lifetimeRefunded" = "lifetimeRefunded" + ${lifetime === "lifetimeRefunded" ? lifetimeDelta : 0},
        "updatedAt" = now()
    WHERE id = ${wallet.id} AND balance + ${amount} >= 0
    RETURNING balance`;
  if (rows.length === 0) {
    throw new AppError("INSUFFICIENT_CREDITS", "You don't have enough credits for this action.", { balance: wallet.balance, required: -amount });
  }
  const balanceAfter = Number(rows[0].balance);
  const row = await tx.creditTransaction.create({
    data: {
      walletId: wallet.id,
      userId: change.userId,
      type: change.type,
      amount,
      balanceAfter,
      idempotencyKey: change.idempotencyKey,
      description: change.description,
      reason: change.reason,
      jobId: change.jobId,
      paymentOrderId: change.paymentOrderId,
      subscriptionId: change.subscriptionId,
      adminId: change.adminId,
      metadata: change.metadata ?? {},
    },
  });
  return { transactionId: row.id, balanceAfter, amount, duplicate: false };
}

/** Standalone, idempotent credit change in its own transaction. Safe to call repeatedly with the same key. */
export async function applyCreditChange(change: CreditChange): Promise<CreditResult> {
  try {
    return await db.$transaction((tx) => applyCreditChangeTx(tx, change));
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey: change.idempotencyKey } });
      if (existing) return { transactionId: existing.id, balanceAfter: existing.balanceAfter, amount: existing.amount, duplicate: true };
    }
    throw err;
  }
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await db.creditWallet.findUnique({ where: { userId }, select: { balance: true } });
  return wallet?.balance ?? 0;
}
