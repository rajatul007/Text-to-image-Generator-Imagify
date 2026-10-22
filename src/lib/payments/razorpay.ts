import { env } from "../env";
import { hmacSha256Hex, safeEqual } from "../crypto";
import { AppError } from "../errors";
import { logger } from "../logger";

export function razorpayConfigured() {
  const e = env();
  return Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId() {
  return env().RAZORPAY_KEY_ID ?? "";
}

export function isTestMode() {
  return razorpayKeyId().startsWith("rzp_test_");
}

async function api<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const e = env();
  if (!razorpayConfigured()) throw new AppError("NOT_CONFIGURED", "Payments are not configured on this server yet.");
  const auth = Buffer.from(`${e.RAZORPAY_KEY_ID}:${e.RAZORPAY_KEY_SECRET}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${e.RAZORPAY_API_BASE}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    logger.error("razorpay request failed", { path, error: (err as Error).message });
    throw new AppError("PROVIDER_UNAVAILABLE", "The payment service is unreachable. Please try again.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string; code?: string } };
  if (!res.ok) {
    logger.error("razorpay error", { path, status: res.status, code: json.error?.code, description: json.error?.description });
    throw new AppError(res.status >= 500 ? "PROVIDER_UNAVAILABLE" : "BAD_REQUEST", "The payment service rejected the request. Please try again.");
  }
  return json;
}

export interface RzpOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes?: Record<string, string>;
}

export interface RzpPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_description?: string | null;
  subscription_id?: string | null;
}

export interface RzpSubscription {
  id: string;
  plan_id: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
  short_url?: string;
  notes?: Record<string, string>;
}

export interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

export const razorpay = {
  createOrder: (input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) => api<RzpOrder>("POST", "/orders", input),
  fetchOrder: (id: string) => api<RzpOrder>("GET", `/orders/${encodeURIComponent(id)}`),
  fetchOrderPayments: (id: string) => api<{ items: RzpPayment[] }>("GET", `/orders/${encodeURIComponent(id)}/payments`),
  fetchPayment: (id: string) => api<RzpPayment>("GET", `/payments/${encodeURIComponent(id)}`),
  refundPayment: (id: string, amount: number, notes: Record<string, string>) => api<RzpRefund>("POST", `/payments/${encodeURIComponent(id)}/refund`, { amount, notes }),
  createSubscription: (input: { plan_id: string; total_count: number; customer_notify: 0 | 1; notes: Record<string, string> }) =>
    api<RzpSubscription>("POST", "/subscriptions", input),
  fetchSubscription: (id: string) => api<RzpSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`),
  cancelSubscription: (id: string, atCycleEnd: boolean) =>
    api<RzpSubscription>("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  updateSubscription: (id: string, planId: string) =>
    api<RzpSubscription>("PATCH", `/subscriptions/${encodeURIComponent(id)}`, { plan_id: planId, schedule_change_at: "cycle_end", customer_notify: 1 }),
};

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = env().RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  return safeEqual(hmacSha256Hex(secret, `${orderId}|${paymentId}`), signature);
}

/** Subscription checkout signature: HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
export function verifySubscriptionSignature(subscriptionId: string, paymentId: string, signature: string): boolean {
  const secret = env().RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  return safeEqual(hmacSha256Hex(secret, `${paymentId}|${subscriptionId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env().RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return safeEqual(hmacSha256Hex(secret, rawBody), signature);
}

export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);
}
