import type { Prisma } from "@prisma/client";
import { db, isUniqueViolation } from "../db";
import { sha256 } from "../crypto";
import { recordError } from "../logger";
import { fulfillOrder, markOrderFailed, recordRefund } from "./orders";
import { allocateSubscriptionCredits, notifySubscriptionProblem, syncSubscription } from "./subscriptions";
import { verifyWebhookSignature, type RzpPayment, type RzpRefund, type RzpSubscription } from "./razorpay";

interface WebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RzpPayment };
    order?: { entity: { id: string } };
    refund?: { entity: RzpRefund };
    subscription?: { entity: RzpSubscription };
  };
}

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

/**
 * Verifies and processes a Razorpay webhook exactly once per event id.
 * Returns 2xx for processed/duplicate/ignored events and 5xx for transient failures (Razorpay retries those).
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null): Promise<WebhookOutcome> {
  const valid = verifyWebhookSignature(rawBody, signature);
  let parsed: WebhookPayload;
  try {
    parsed = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }
  const eventId = eventIdHeader || `body:${sha256(rawBody)}`;
  if (!valid) {
    await db.paymentWebhookEvent
      .create({ data: { eventId: `invalid:${sha256(rawBody + Date.now())}`, event: parsed.event ?? "unknown", signatureValid: false, status: "IGNORED", payload: {}, error: "invalid signature" } })
      .catch(() => undefined);
    return { status: 401, body: { error: "invalid signature" } };
  }

  let record;
  try {
    record = await db.paymentWebhookEvent.create({ data: { eventId, event: parsed.event, signatureValid: true, payload: parsed as unknown as Prisma.InputJsonValue } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await db.paymentWebhookEvent.findUniqueOrThrow({ where: { eventId } });
    if (existing.status === "PROCESSED" || existing.status === "IGNORED") return { status: 200, body: { ok: true, duplicate: true } };
    record = existing; // previously FAILED / still RECEIVED → reprocess (handlers are idempotent)
  }

  try {
    const handled = await dispatch(parsed);
    await db.paymentWebhookEvent.update({ where: { id: record.id }, data: { status: handled ? "PROCESSED" : "IGNORED", processedAt: new Date(), error: null } });
    return { status: 200, body: { ok: true } };
  } catch (err) {
    await db.paymentWebhookEvent.update({ where: { id: record.id }, data: { status: "FAILED", error: (err as Error).message.slice(0, 500) } });
    await recordError("razorpay-webhook", err, { eventId, event: parsed.event });
    return { status: 500, body: { error: "processing failed" } };
  }
}

async function dispatch(evt: WebhookPayload): Promise<boolean> {
  const payment = evt.payload.payment?.entity;
  switch (evt.event) {
    case "payment.captured":
    case "order.paid": {
      if (!payment?.order_id) return false;
      if (payment.status !== "captured") return false;
      const order = await db.paymentOrder.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (!order) return false;
      await fulfillOrder(order.id, payment);
      return true;
    }
    case "payment.failed": {
      if (!payment?.order_id) return false;
      const order = await db.paymentOrder.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (!order) return false;
      await markOrderFailed(order, payment.error_description ?? "Payment failed");
      return true;
    }
    case "refund.created":
    case "refund.processed": {
      const refund = evt.payload.refund?.entity;
      if (!refund) return false;
      if (evt.event === "refund.created" && refund.status !== "processed") return false;
      const res = await recordRefund(refund);
      return !res.ignored;
    }
    case "subscription.charged": {
      const sub = evt.payload.subscription?.entity;
      if (!sub || !payment) return false;
      return Boolean(await allocateSubscriptionCredits(sub, payment.id));
    }
    case "subscription.authenticated":
    case "subscription.activated":
    case "subscription.updated":
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.paused":
    case "subscription.resumed": {
      const sub = evt.payload.subscription?.entity;
      if (!sub) return false;
      return Boolean(await syncSubscription(sub));
    }
    case "subscription.pending":
    case "subscription.halted": {
      const sub = evt.payload.subscription?.entity;
      if (!sub) return false;
      await syncSubscription(sub);
      await notifySubscriptionProblem(sub);
      return true;
    }
    default:
      return false;
  }
}
