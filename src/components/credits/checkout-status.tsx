"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Panel } from "../ui/misc";
import { Spinner } from "../ui/spinner";
import { api } from "@/lib/client/api";
import { formatInr } from "@/lib/utils";

interface Order {
  id: string;
  status: "CREATED" | "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  credits: number;
  amountPaise: number;
  packageName: string;
  receipt: string;
  failureReason: string | null;
}

/** Shows the server-verified order status. Polls while Razorpay is still confirming (webhook). */
export function CheckoutStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let stop = false;
    let n = 0;
    const tick = async () => {
      try {
        const res = await api<{ order: Order; balance: number }>(`/api/checkout/${orderId}`);
        if (stop) return;
        setOrder(res.order);
        setBalance(res.balance);
        n += 1;
        setAttempts(n);
        if ((res.order.status === "PENDING" || res.order.status === "CREATED") && n < 40) setTimeout(tick, 2500);
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [orderId]);

  if (error) return <Panel className="p-6 text-sm text-danger">{error}</Panel>;
  if (!order)
    return (
      <Panel className="flex items-center gap-3 p-6 text-sm text-muted">
        <Spinner className="size-5 text-violet" /> Checking your payment…
      </Panel>
    );
  const paid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED" || order.status === "REFUNDED";
  const pending = order.status === "PENDING" || order.status === "CREATED";
  return (
    <Panel className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        {paid ? <CheckCircle2 className="size-8 shrink-0 text-ok" /> : pending ? <Clock className="size-8 shrink-0 text-warn" /> : <XCircle className="size-8 shrink-0 text-danger" />}
        <div>
          <h1 className="font-display text-2xl font-semibold">{paid ? "Payment successful" : pending ? "Payment pending" : order.status === "CANCELLED" ? "Checkout cancelled" : "Payment failed"}</h1>
          <p className="mt-1 text-sm text-muted">
            {paid
              ? `${order.credits.toLocaleString("en-IN")} credits from ${order.packageName} were added. Your balance is ${balance?.toLocaleString("en-IN")} credits.`
              : pending
                ? attempts >= 40
                  ? "Razorpay hasn't confirmed this payment yet. Credits will be added automatically once it does – you can safely leave this page."
                  : "We're waiting for Razorpay to confirm your payment. This usually takes a few seconds."
                : order.status === "CANCELLED"
                  ? "No payment was taken."
                  : `${order.failureReason ?? "The payment didn't go through."} No credits were charged; any debited amount is reversed automatically by your bank.`}
          </p>
          <p className="mt-3 text-xs text-faint">
            Receipt {order.receipt} · {formatInr(order.amountPaise)}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {paid ? (
              <>
                <Button asChild>
                  <Link href="/generate">Start generating</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/transactions/receipt/${order.id}`}>View receipt</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant={pending ? "secondary" : "primary"}>
                <Link href="/credits">{pending ? "Back to credits" : "Try again"}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
