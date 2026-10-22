import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/lib/payments/razorpay";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as verify } from "@/app/api/checkout/verify/route";
import { POST as webhook } from "@/app/api/webhooks/razorpay/route";
import { balanceOf, call, installFetch, makeUser, resetDb } from "./helpers";

const SECRET = "rzp_test_secret";
const WH = "whsec_test";
const sign = (s: string, payload: string) => createHmac("sha256", s).update(payload).digest("hex");

interface FakeRzp {
  orders: Map<string, { amount: number; receipt: string }>;
  payments: Map<string, { order_id: string; amount: number; status: string }>;
}

function fakeRazorpay(): FakeRzp {
  const state: FakeRzp = { orders: new Map(), payments: new Map() };
  installFetch({
    "http://razorpay.test/v1/orders": async (_url, init) => {
      const body = JSON.parse(String(init.body));
      const id = `order_${state.orders.size + 1}`;
      state.orders.set(id, { amount: body.amount, receipt: body.receipt });
      return Response.json({ id, amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created" });
    },
    "http://razorpay.test/v1/payments/": async (url) => {
      const id = decodeURIComponent(url.split("/payments/")[1]);
      const p = state.payments.get(id);
      return p ? Response.json({ id, currency: "INR", method: "upi", ...p }) : Response.json({ error: { description: "not found" } }, { status: 404 });
    },
  });
  return state;
}

async function startCheckout(session: string, rzp: FakeRzp, slug = "creator") {
  const res = await call(checkout, "/api/checkout", { session, body: { packageId: slug } });
  expect(res.status).toBe(200);
  const paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
  rzp.payments.set(paymentId, { order_id: res.json.razorpayOrderId, amount: res.json.amount, status: "captured" });
  return { ...res.json, paymentId };
}

function webhookCall(payload: object, eventId: string, secret = WH) {
  const raw = JSON.stringify(payload);
  return call(webhook, "/api/webhooks/razorpay", { rawBody: raw, origin: null, headers: { "x-razorpay-signature": sign(secret, raw), "x-razorpay-event-id": eventId, "content-type": "application/json" } });
}

describe("Razorpay payments", () => {
  beforeEach(resetDb);

  it("verifies checkout and webhook signatures with constant-time HMAC comparison", () => {
    const sig = sign(SECRET, "order_1|pay_1");
    expect(verifyPaymentSignature("order_1", "pay_1", sig)).toBe(true);
    expect(verifyPaymentSignature("order_1", "pay_2", sig)).toBe(false);
    expect(verifyWebhookSignature("{}", sign(WH, "{}"))).toBe(true);
    expect(verifyWebhookSignature("{}", sign("other", "{}"))).toBe(false);
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("creates orders with server-side prices only", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const res = await call(checkout, "/api/checkout", { session, body: { packageId: "creator", amount: 1, credits: 999999 } });
    expect(res.json.amount).toBe(29_900);
    expect(rzp.orders.get(res.json.razorpayOrderId)?.amount).toBe(29_900);
    const order = await db.paymentOrder.findFirstOrThrow({ where: { userId: user.id } });
    expect(order.credits).toBe(400);
    expect(order.status).toBe("PENDING");
    expect(JSON.stringify(res.json)).not.toContain(SECRET);
  });

  it("does not add credits for a forged signature", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const co = await startCheckout(session, rzp);
    const res = await call(verify, "/api/checkout/verify", { session, body: { razorpay_order_id: co.razorpayOrderId, razorpay_payment_id: co.paymentId, razorpay_signature: "f".repeat(64) } });
    expect(res.status).toBe(400);
    expect(await balanceOf(user.id)).toBe(0);
  });

  it("adds credits only after signature + server-side payment check, exactly once", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const co = await startCheckout(session, rzp);
    const body = { razorpay_order_id: co.razorpayOrderId, razorpay_payment_id: co.paymentId, razorpay_signature: sign(SECRET, `${co.razorpayOrderId}|${co.paymentId}`) };
    const [a, b] = await Promise.all([call(verify, "/api/checkout/verify", { session, body }), call(verify, "/api/checkout/verify", { session, body })]);
    expect([a.json.status, b.json.status]).toEqual(["PAID", "PAID"]);
    expect(await balanceOf(user.id)).toBe(400);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: "PURCHASE" } })).toBe(1);
    const order = await db.paymentOrder.findFirstOrThrow({ where: { userId: user.id } });
    expect(order.status).toBe("PAID");
    expect(order.razorpayPaymentId).toBe(co.paymentId);
  });

  it("keeps the order pending if the payment is only authorized", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const co = await startCheckout(session, rzp);
    rzp.payments.get(co.paymentId)!.status = "authorized";
    const res = await call(verify, "/api/checkout/verify", { session, body: { razorpay_order_id: co.razorpayOrderId, razorpay_payment_id: co.paymentId, razorpay_signature: sign(SECRET, `${co.razorpayOrderId}|${co.paymentId}`) } });
    expect(res.json.status).toBe("PENDING");
    expect(await balanceOf(user.id)).toBe(0);
  });

  it("rejects webhooks with invalid signatures", async () => {
    const res = await webhookCall({ event: "payment.captured", payload: {} }, "evt_bad", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("fulfils from the payment.captured webhook, ignores duplicate deliveries, and races safely with browser verification", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const co = await startCheckout(session, rzp, "pro");
    const payload = { event: "payment.captured", payload: { payment: { entity: { id: co.paymentId, order_id: co.razorpayOrderId, amount: 69_900, currency: "INR", status: "captured", method: "card" } } } };
    const verifyBody = { razorpay_order_id: co.razorpayOrderId, razorpay_payment_id: co.paymentId, razorpay_signature: sign(SECRET, `${co.razorpayOrderId}|${co.paymentId}`) };
    const results = await Promise.all([webhookCall(payload, "evt_1"), webhookCall(payload, "evt_1"), call(verify, "/api/checkout/verify", { session, body: verifyBody }), webhookCall({ ...payload, event: "order.paid" }, "evt_2")]);
    expect(results.map((r) => [r.status, r.json])).toEqual(results.map((r) => [200, r.json]));
    expect(await balanceOf(user.id)).toBe(1000);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: "PURCHASE" } })).toBe(1);
    expect(await db.paymentWebhookEvent.count({ where: { eventId: "evt_1" } })).toBe(1);
    expect((await webhookCall(payload, "evt_1")).json.duplicate).toBe(true);
  });

  it("rejects a captured payment whose amount doesn't match the order", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const co = await startCheckout(session, rzp);
    const res = await webhookCall({ event: "payment.captured", payload: { payment: { entity: { id: co.paymentId, order_id: co.razorpayOrderId, amount: 100, currency: "INR", status: "captured" } } } }, "evt_amt");
    expect(res.status).toBe(500); // recorded as FAILED for investigation
    expect(await balanceOf(user.id)).toBe(0);
    expect((await db.paymentWebhookEvent.findUniqueOrThrow({ where: { eventId: "evt_amt" } })).status).toBe("FAILED");
  });

  it("marks failed payments and records refunds with a one-time credit reversal", async () => {
    const rzp = fakeRazorpay();
    const { session, user } = await makeUser();
    const failed = await startCheckout(session, rzp, "starter");
    await webhookCall({ event: "payment.failed", payload: { payment: { entity: { id: failed.paymentId, order_id: failed.razorpayOrderId, amount: 9900, currency: "INR", status: "failed", error_description: "Card declined" } } } }, "evt_f");
    expect((await db.paymentOrder.findFirstOrThrow({ where: { razorpayOrderId: failed.razorpayOrderId } })).status).toBe("FAILED");

    const co = await startCheckout(session, rzp, "creator");
    await webhookCall({ event: "payment.captured", payload: { payment: { entity: { id: co.paymentId, order_id: co.razorpayOrderId, amount: 29_900, currency: "INR", status: "captured" } } } }, "evt_c");
    expect(await balanceOf(user.id)).toBe(400);
    const refund = { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: co.paymentId, amount: 14_950, status: "processed" } } } };
    await webhookCall(refund, "evt_r1");
    await webhookCall(refund, "evt_r2"); // same refund delivered under another event id
    expect(await balanceOf(user.id)).toBe(200);
    const order = await db.paymentOrder.findFirstOrThrow({ where: { razorpayOrderId: co.razorpayOrderId } });
    expect(order.status).toBe("PARTIALLY_REFUNDED");
    expect(order.refundedPaise).toBe(14_950);
    expect(await db.paymentRefund.count()).toBe(1);
  });

  it("allocates subscription credits once per billing period", async () => {
    fakeRazorpay();
    const { user } = await makeUser();
    const plan = await db.subscriptionPlan.findFirstOrThrow({ where: { slug: "creator-monthly" } });
    await db.subscription.create({ data: { userId: user.id, planId: plan.id, razorpaySubscriptionId: "sub_1", status: "AUTHENTICATED" } });
    const sub = (start: number) => ({ id: "sub_1", plan_id: plan.razorpayPlanId!, status: "active", current_start: start, current_end: start + 30 * 86400 });
    const charged = (start: number, pay: string) => ({ event: "subscription.charged", payload: { subscription: { entity: sub(start) }, payment: { entity: { id: pay, order_id: null, amount: plan.pricePaise, currency: "INR", status: "captured" } } } });
    await webhookCall(charged(1_700_000_000, "pay_s1"), "evt_s1");
    await webhookCall(charged(1_700_000_000, "pay_s1"), "evt_s1_retry");
    expect(await balanceOf(user.id)).toBe(400);
    await webhookCall(charged(1_702_592_000, "pay_s2"), "evt_s2");
    expect(await balanceOf(user.id)).toBe(800);
    const s = await db.subscription.findUniqueOrThrow({ where: { razorpaySubscriptionId: "sub_1" } });
    expect(s.status).toBe("ACTIVE");
    expect(s.currentPeriodEnd).not.toBeNull();
    await webhookCall({ event: "subscription.halted", payload: { subscription: { entity: { ...sub(1_702_592_000), status: "halted" } } } }, "evt_h");
    expect((await db.subscription.findUniqueOrThrow({ where: { razorpaySubscriptionId: "sub_1" } })).status).toBe("HALTED");
  });
});
