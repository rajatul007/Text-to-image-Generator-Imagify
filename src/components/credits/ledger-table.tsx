"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "../ui/misc";
import { Pagination } from "../ui/pagination";
import { Dialog, DialogContent } from "../ui/dialog";
import { DateInput, FilterSelect, SearchBox } from "../library/filters";
import { api } from "@/lib/client/api";
import { useQueryState } from "@/hooks/use-query-state";
import { cn, formatDate, formatInr } from "@/lib/utils";

interface Tx {
  id: string;
  type: string;
  typeLabel: string;
  amount: number;
  balanceAfter: number;
  description: string;
  reason: string | null;
  jobId: string | null;
  createdAt: string;
  order: { id: string; amountPaise: number; status: string; receipt: string; packageName: string } | null;
}

const KEYS = ["q", "type", "direction", "from", "to"] as const;
const TYPES = [
  ["PURCHASE", "Credit purchase"],
  ["GENERATION_CHARGE", "Image generation"],
  ["REFUND", "Refund"],
  ["WELCOME_BONUS", "Welcome bonus"],
  ["PROMOTIONAL", "Promotional reward"],
  ["SUBSCRIPTION_ALLOCATION", "Subscription credits"],
  ["ADMIN_ADJUSTMENT", "Admin adjustment"],
  ["PAYMENT_REVERSAL", "Payment refund reversal"],
] as const;

export function LedgerTable() {
  const [f, set, sp] = useQueryState(KEYS);
  const page = Number(sp.get("page") ?? 1) || 1;
  const [q, setQ] = useState(f.q);
  const [data, setData] = useState<{ items: Tx[]; pages: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Tx | null>(null);

  useEffect(() => {
    const t = setTimeout(() => q !== f.q && set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, f.q, set]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    for (const k of KEYS) if (f[k]) params.set(k, f[k]);
    try {
      setError(null);
      setData(await api(`/api/credits/ledger?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f, page]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on filter change
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search by ID or description" />
        <FilterSelect label="Type" value={f.type} onChange={(v) => set({ type: v })}>
          <option value="">All types</option>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Direction" value={f.direction} onChange={(v) => set({ direction: v })}>
          <option value="">Added & deducted</option>
          <option value="in">Credits added</option>
          <option value="out">Credits deducted</option>
        </FilterSelect>
        <DateInput label="From date" value={f.from} onChange={(v) => set({ from: v })} />
        <DateInput label="To date" value={f.to} onChange={(v) => set({ to: v })} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!data && !error && <Skeleton className="h-96" />}
      {data?.items.length === 0 && (
        <EmptyState icon={<Receipt className="size-5" />} title="No transactions found">
          Credit purchases, generation charges, refunds and bonuses are all recorded here.
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Credits</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {data.items.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-panel-2/60" onClick={() => setDetail(t)}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(t.createdAt, true)}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-left hover:underline" onClick={() => setDetail(t)}>
                      {t.typeLabel}
                    </button>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">{t.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{t.order ? formatInr(t.order.amountPaise) : "–"}</td>
                  <td className={cn("px-4 py-3 text-right font-medium tabular-nums", t.amount > 0 ? "text-ok" : t.amount < 0 ? "text-text" : "text-muted")}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{t.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} pages={data.pages} onChange={(p) => set({ page: String(p) })} />}
      {detail && (
        <Dialog open onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent title={detail.typeLabel} description={formatDate(detail.createdAt, true)}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-faint">Transaction ID</dt>
              <dd className="break-all font-mono text-xs">{detail.id}</dd>
              <dt className="text-faint">Credits</dt>
              <dd className="tabular-nums">
                {detail.amount > 0 ? "+" : ""}
                {detail.amount} (balance after: {detail.balanceAfter})
              </dd>
              <dt className="text-faint">Description</dt>
              <dd>{detail.description}</dd>
              {detail.reason && (
                <>
                  <dt className="text-faint">Reason</dt>
                  <dd>{detail.reason}</dd>
                </>
              )}
              {detail.order && (
                <>
                  <dt className="text-faint">Payment</dt>
                  <dd>
                    {formatInr(detail.order.amountPaise)} · <Badge>{detail.order.status.toLowerCase().replace("_", " ")}</Badge>
                  </dd>
                  <dt className="text-faint">Receipt</dt>
                  <dd>
                    <Link href={`/transactions/receipt/${detail.order.id}`} className="text-violet hover:underline">
                      {detail.order.receipt}
                    </Link>
                  </dd>
                </>
              )}
              {detail.jobId && (
                <>
                  <dt className="text-faint">Generation</dt>
                  <dd>
                    <Link href={`/history?job=${detail.jobId}`} className="text-violet hover:underline">
                      View in history
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
