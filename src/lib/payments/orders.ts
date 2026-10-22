import type { PaymentOrder } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { randomToken } from "../crypto";
import { AppError, notFound } from "../errors";
import { applyCreditChange, applyCreditChangeTx } from "../credits/ledger";
import { notify } from "../notifications";
import { templates } from "../email/templates";
import { formatInr, razorpay, razorpayKeyId, verifyPaymentSignature } from "./razorpay";

function receiptNumber() {
  const d = new Date();
  return `PF-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}-${randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
}

/** Creates a Razorpay order for a credit package. Price and credits always come from the database. */
export async function createCheckout(user: { id: string; name: string; email: string }, packageId: string) {
  const pkg = await db.creditPackage.findFirst({ where: { OR: [{ id: packageId }, { slug: packageId }], active: true } });
  if (!pkg) throw notFound("Credit package");
  const receipt = receiptNumber();
  const order = await db.paymentOrder.create({
    data: { userId: user.id, packageId: pkg.id, receipt, amountPaise: pkg.pricePaise, currency: pkg.currency, credits: pkg.credits, packageName: pkg.name },
  });
  try {
    const rzp = await razorpay.createOrder({ amount: pkg.pricePaise, currency: pkg.currency, receipt, notes: { orderId: order.id, userId: user.id, package: pkg.slug } });
    await db.paymentOrder.update({ where: { id: order.id }, data: { razorpayOrderId: rzp.id, status: "PENDING" } });
    return {
      orderId: order.id,
      keyId: razorpayKeyId(),
      razorpayOrderId: rzp.id,
      amount: pkg.pricePaise,
      currency: pkg.currency,
      name: "Text to Image Generator",
      description: `${pkg.name} – ${pkg.credits.toLocaleString("en-IN")} credits`,
      prefill: { name: user.name, email: user.email },
      callbackUrl: `${env().APP_URL}/checkout/success?order=${order.id}`,
    };
  } catch (err) {
    await db.paymentOrder.update({ where: { id: order.id }, data: { status: "FAILED", failureReason: "Could not create payment order" } });
    throw err;
  }
}

/**
 * Marks an order paid and adds credits – exactly once, no matter how many times it is called
 * (browser verification, `payment.captured` and `order.paid` webhooks can all race).
 */
export async function fulfillOrder(orderId: string, payment: { id: string; amount: number; currency: string; method?: string | null }) {
  const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  if (payment.amount !== order.amountPaise || payment.currency !== order.currency) {
    throw new AppError("BAD_REQUEST", "Payment amount does not match the order");
  }
  const result = await db.$transaction(async (tx) => {
    await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { notIn: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } },
      data: { status: "PAID", paidAt: new Date(), razorpayPaymentId: payment.id, method: payment.method ?? null, failureReason: null },
    });
    const credit = await applyCreditChangeTx(tx, {
      userId: order.userId,
      amount: order.credits,
      type: "PURCHASE",
      idempotencyKey: `purchase:order:${order.id}`,
      description: `Purchased ${order.packageName} – ${order.credits} credits`,
      paymentOrderId: order.id,
      metadata: { razorpayPaymentId: payment.id, amountPaise: order.amountPaise },
    });
    if (!credit.duplicate) await tx.paymentOrder.update({ where: { id: order.id }, data: { fulfilledAt: new Date() } });
    return credit;
  }).catch(async (err) => {
    // Concurrent fulfilment lost the race on the ledger's unique key → already fulfilled.
    if ((err as { code?: string }).code === "P2002") {
      const tx = await db.creditTransaction.findUnique({ where: { idempotencyKey: `purchase:order:${order.id}` } });
      if (tx) return { transactionId: tx.id, balanceAfter: tx.balanceAfter, amount: tx.amount, duplicate: true };
    }
    throw err;
  });
  if (!result.duplicate) {
    void notify({
      userId: order.userId,
      type: "PAYMENT_SUCCESS",
      title: "Payment successful",
      body: `${order.credits} credits were added to your wallet.`,
      link: `/transactions/receipt/${order.id}`,
      email: { pref: "emailPayments", template: "paymentSuccess", build: (name, url) => templates.paymentSuccess(name, order.credits, formatInr(order.amountPaise), `${url}/transactions/receipt/${order.id}`) },
    });
  }
  return result;
}

/** Browser callback after Razorpay Checkout. Credits are granted only after signature AND server-side payment status checks. */
export async function verifyCheckout(userId: string, input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const order = await db.paymentOrder.findFirst({ where: { razorpayOrderId: input.razorpay_order_id, userId } });
  if (!order) throw notFound("Order");
  if (!verifyPaymentSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
    throw new AppError("BAD_REQUEST", "Payment verification failed. If money was deducted it will be refunded automatically.");
  }
  await db.paymentOrder.update({ where: { id: order.id }, data: { signatureVerifiedAt: new Date() } });
  const payment = await razorpay.fetchPayment(input.razorpay_payment_id);
  if (payment.order_id !== input.razorpay_order_id) throw new AppError("BAD_REQUEST", "Payment does not belong to this order");
  if (payment.status === "captured") {
    await fulfillOrder(order.id, payment);
    return { status: "PAID" as const, orderId: order.id };
  }
  if (payment.status === "failed") {
    await markOrderFailed(order, payment.error_description ?? "Payment failed");
    return { status: "FAILED" as const, orderId: order.id };
  }
  // "authorized" – capture happens automatically (account setting) and is confirmed by webhook.
  await db.paymentOrder.updateMany({ where: { id: order.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "PENDING", razorpayPaymentId: payment.id } });
  return { status: "PENDING" as const, orderId: order.id };
}

export async function markOrderFailed(order: PaymentOrder, reason: string) {
  const res = await db.paymentOrder.updateMany({ where: { id: order.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
  if (res.count === 1) {
    void notify({
      userId: order.userId,
      type: "PAYMENT_FAILED",
      title: "Payment failed",
      body: `Your payment for ${order.packageName} failed. No credits were charged.`,
      link: "/credits",
      email: { pref: "emailPayments", template: "paymentFailed", build: (name, url) => templates.paymentFailed(name, formatInr(order.amountPaise), `${url}/credits`) },
    });
  }
}

export async function cancelCheckout(userId: string, orderId: string) {
  await db.paymentOrder.updateMany({ where: { id: orderId, userId, status: { in: ["CREATED", "PENDING"] }, razorpayPaymentId: null }, data: { status: "CANCELLED" } });
  return db.paymentOrder.findFirst({ where: { id: orderId, userId } });
}

/** Records a Razorpay refund once and reverses the proportional share of purchased credits (never below zero). */
export async function recordRefund(refund: { id: string; payment_id: string; amount: number; status: string }) {
  const order = await db.paymentOrder.findUnique({ where: { razorpayPaymentId: refund.payment_id } });
  if (!order) return { ignored: true as const };
  const existing = await db.paymentRefund.findUnique({ where: { razorpayRefundId: refund.id } });
  if (existing) return { ignored: false as const, duplicate: true };
  const creditsToReverse = Math.min(order.credits, Math.round((order.credits * refund.amount) / order.amountPaise));
  const reversal = await applyCreditChange({
    userId: order.userId,
    amount: -Math.max(1, creditsToReverse),
    type: "PAYMENT_REVERSAL",
    idempotencyKey: `reversal:refund:${refund.id}`,
    description: `Payment refunded (${formatInr(refund.amount)}) – purchased credits reversed`,
    paymentOrderId: order.id,
    clampAtZero: true,
    metadata: { razorpayRefundId: refund.id },
  });
  try {
    await db.$transaction(async (tx) => {
      await tx.paymentRefund.create({ data: { orderId: order.id, razorpayRefundId: refund.id, amountPaise: refund.amount, status: refund.status, creditsReversed: -reversal.amount } });
      const totalRefunded = order.refundedPaise + refund.amount;
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { refundedPaise: totalRefunded, status: totalRefunded >= order.amountPaise ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return { ignored: false as const, duplicate: true };
    throw err;
  }
  void notify({
    userId: order.userId,
    type: "REFUND",
    title: "Refund processed",
    body: `A refund of ${formatInr(refund.amount)} for ${order.packageName} was processed.`,
    link: `/transactions/receipt/${order.id}`,
    email: { pref: "emailPayments", template: "refundProcessed", build: (name) => templates.refundProcessed(name, formatInr(refund.amount), -reversal.amount) },
  });
  return { ignored: false as const, duplicate: false };
}
