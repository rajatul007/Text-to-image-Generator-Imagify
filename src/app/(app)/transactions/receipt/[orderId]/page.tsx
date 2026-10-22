import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "@/components/credits/print-button";
import { formatDate, formatInr } from "@/lib/utils";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requirePageUser(`/transactions/receipt/${orderId}`);
  const order = await db.paymentOrder.findFirst({ where: { id: orderId, userId: user.id }, include: { refunds: true } });
  if (!order || !["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.status)) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="rounded-[var(--radius-panel)] border border-line bg-panel p-8 print:border-0 print:bg-white print:text-black">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="font-display text-lg font-semibold">Text to Image Generator</div>
              <div className="text-xs text-muted">Payment receipt</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">{order.receipt}</div>
            <div className="text-muted">{formatDate(order.paidAt ?? order.createdAt, true)}</div>
          </div>
        </header>
        <dl className="mt-8 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Billed to</dt>
          <dd className="text-right">
            {user.name}
            <br />
            {user.email}
          </dd>
          <dt className="text-muted">Item</dt>
          <dd className="text-right">
            {order.packageName} – {order.credits.toLocaleString("en-IN")} credits
          </dd>
          <dt className="text-muted">Payment ID</dt>
          <dd className="break-all text-right font-mono text-xs">{order.razorpayPaymentId}</dd>
          {order.method && (
            <>
              <dt className="text-muted">Method</dt>
              <dd className="text-right uppercase">{order.method}</dd>
            </>
          )}
        </dl>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="font-medium">Total paid (incl. taxes)</span>
          <span className="font-display text-2xl font-semibold">{formatInr(order.amountPaise)}</span>
        </div>
        {order.refunds.length > 0 && (
          <div className="mt-4 space-y-1 text-sm">
            {order.refunds.map((r) => (
              <div key={r.id} className="flex justify-between text-muted">
                <span>Refund {r.razorpayRefundId} ({formatDate(r.createdAt)})</span>
                <span>−{formatInr(r.amountPaise)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-8 text-xs text-faint">Payment processed by Razorpay. This receipt is generated from our payment records; contact support with the receipt number for a GST invoice.</p>
      </article>
    </div>
  );
}
