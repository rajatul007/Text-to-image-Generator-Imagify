import Link from "next/link";
import { db } from "@/lib/db";
import { RefundDialog } from "@/components/admin/refund-dialog";
import { Badge, PageHeader, Stat } from "@/components/ui/misc";
import { isTestMode, razorpayConfigured } from "@/lib/payments/razorpay";
import { env } from "@/lib/env";
import { formatDate, formatInr } from "@/lib/utils";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const tone = (s: string) => (s === "PAID" || s === "PROCESSED" ? "ok" : s === "FAILED" ? "danger" : s.includes("REFUND") ? "warn" : "neutral") as "ok" | "danger" | "warn" | "neutral";

export default async function AdminPayments({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const tab = sp.tab === "webhooks" ? "webhooks" : "orders";
  const [orders, events, agg] = await Promise.all([
    db.paymentOrder.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { email: true, id: true } }, refunds: true } }),
    db.paymentWebhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, eventId: true, event: true, status: true, signatureValid: true, error: true, createdAt: true } }),
    db.paymentOrder.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountPaise: true } }),
  ]);
  const sum = (s: string) => agg.find((a) => a.status === s);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={
          razorpayConfigured()
            ? `Razorpay ${isTestMode() ? "test" : "live"} mode · webhook URL ${env().APP_URL}/api/webhooks/razorpay`
            : "Razorpay is not configured – set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET."
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid orders" value={sum("PAID")?._count._all ?? 0} hint={formatInr(sum("PAID")?._sum.amountPaise ?? 0)} />
        <Stat label="Pending" value={(sum("PENDING")?._count._all ?? 0) + (sum("CREATED")?._count._all ?? 0)} />
        <Stat label="Failed / cancelled" value={(sum("FAILED")?._count._all ?? 0) + (sum("CANCELLED")?._count._all ?? 0)} />
        <Stat label="Refunded orders" value={(sum("REFUNDED")?._count._all ?? 0) + (sum("PARTIALLY_REFUNDED")?._count._all ?? 0)} />
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/admin/payments" className={tab === "orders" ? "font-medium text-text" : "text-muted"}>
          Orders
        </Link>
        <span className="text-faint">/</span>
        <Link href="/admin/payments?tab=webhooks" className={tab === "webhooks" ? "font-medium text-text" : "text-muted"}>
          Webhook events
        </Link>
      </div>
      {tab === "orders" ? (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Razorpay IDs</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">{o.receipt}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/users/${o.user.id}`} className="hover:text-violet">
                      {o.user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {o.packageName} · {o.credits} cr
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatInr(o.amountPaise)}
                    {o.refundedPaise > 0 && <div className="text-xs text-warn">−{formatInr(o.refundedPaise)}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={tone(o.status)}>{o.status.toLowerCase()}</Badge>
                    {o.failureReason && <div className="mt-1 max-w-48 truncate text-xs text-muted">{o.failureReason}</div>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                    {o.razorpayOrderId}
                    <br />
                    {o.razorpayPaymentId}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{formatDate(o.createdAt, true)}</td>
                  <td className="px-4 py-2.5">{["PAID", "PARTIALLY_REFUNDED"].includes(o.status) && <RefundDialog orderId={o.id} refundablePaise={o.amountPaise - o.refundedPaise} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="p-6 text-sm text-muted">No payment orders yet.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Event ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5">{e.event}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{e.eventId.slice(0, 40)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={e.signatureValid ? tone(e.status) : "danger"}>{e.signatureValid ? e.status.toLowerCase() : "bad signature"}</Badge>
                  </td>
                  <td className="max-w-sm truncate px-4 py-2.5 text-xs text-danger">{e.error}</td>
                  <td className="px-4 py-2.5 text-muted">{formatDate(e.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && <p className="p-6 text-sm text-muted">No webhook events received yet.</p>}
        </div>
      )}
    </div>
  );
}
