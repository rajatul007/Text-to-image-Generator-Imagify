"use client";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (r: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => RazorpayInstance;
  }
}

let loader: Promise<void> | null = null;

/** Loads Razorpay Checkout from Razorpay's CDN (required by Razorpay; card/UPI details never touch our servers). */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loader;
}

export function openRazorpay(options: Omit<RazorpayOptions, "theme">, onFailed: (msg: string) => void) {
  if (!window.Razorpay) throw new Error("Payment window unavailable");
  const rzp = new window.Razorpay({ ...options, theme: { color: "#7c5cff" } });
  rzp.on("payment.failed", (r) => onFailed(r.error?.description ?? "Payment failed"));
  rzp.open();
}

export type { RazorpayResponse };
