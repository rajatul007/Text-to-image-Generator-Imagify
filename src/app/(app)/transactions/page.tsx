import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { LedgerTable } from "@/components/credits/ledger-table";
import { PageHeader } from "@/components/ui/misc";
import { formatDate, formatInr } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const user = await requirePageUser("/transactions");
  const orders = await db.paymentOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <div>
        <PageHeader title="Transactions" description="Your credit ledger: every change to your balance, in order. Entries can't be edited or deleted." />
        <Suspense>
          <LedgerTable />
        </Suspense>
      </div>
      <section>
        <h2 className="font-display mb-3 text-xl font-semibold">Payment orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-panel">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {o.packageName} · {o.credits.toLocaleString("en-IN")} credits
                  </p>
                  <p className="text-xs text-faint">
                    {o.receipt} · {formatDate(o.createdAt, true)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{formatInr(o.amountPaise)}</span>
                  <Badge tone={o.status === "PAID" ? "ok" : o.status === "FAILED" ? "danger" : o.status.includes("REFUND") ? "warn" : "neutral"}>{o.status.toLowerCase().replace("_", " ")}</Badge>
                  {["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(o.status) && (
                    <Link href={`/transactions/receipt/${o.id}`} className="text-violet hover:underline">
                      Receipt
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
