import { NextResponse, type NextRequest } from "next/server";
import { handleRazorpayWebhook } from "@/lib/payments/webhooks";

/** Razorpay webhook endpoint. Authenticated by HMAC signature over the raw body (not cookies). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const outcome = await handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), req.headers.get("x-razorpay-event-id"));
  return NextResponse.json(outcome.body, { status: outcome.status });
}
