import Link from "next/link";
import { adminAnalytics } from "@/lib/queries/admin";
import { integrationStatus } from "@/lib/env";
import { DailyGenerationsChart, MonthlyChart, RevenueChart } from "@/components/admin/charts";
import { Alert, Badge, PageHeader, Panel, Stat } from "@/components/ui/misc";
import { formatInr } from "@/lib/utils";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [a, integrations] = await Promise.all([adminAnalytics(), Promise.resolve(integrationStatus())]);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Platform health over all time, with daily trends for the last 30 days." />
      {(a.openReports > 0 || a.failedWebhooks > 0) && (
        <div className="space-y-2">
          {a.openReports > 0 && (
            <Alert tone="warn" title={`${a.openReports} open content report${a.openReports === 1 ? "" : "s"}`} action={<Link href="/admin/reports" className="text-sm text-violet hover:underline">Review</Link>} />
          )}
          {a.failedWebhooks > 0 && (
            <Alert tone="danger" title={`${a.failedWebhooks} failed payment webhook${a.failedWebhooks === 1 ? "" : "s"}`} action={<Link href="/admin/payments?tab=webhooks" className="text-sm text-violet hover:underline">Inspect</Link>} />
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered users" value={a.users.total.toLocaleString("en-IN")} hint={`${a.users.verified} verified · ${a.users.suspended} suspended`} />
        <Stat label="Active users (30 d)" value={a.users.active30d.toLocaleString("en-IN")} />
        <Stat label="Generations" value={a.generations.total.toLocaleString("en-IN")} hint={`${a.generations.completed} ok · ${a.generations.failed} failed · ${a.generations.inFlight} running`} />
        <Stat label="Failure rate" value={pct(a.generations.failureRate)} hint="Failed ÷ finished" />
        <Stat label="Revenue" value={formatInr(a.payments.revenuePaise)} hint={`${a.payments.paidOrders} paid orders`} />
        <Stat label="Refunded" value={formatInr(a.payments.refundedPaise)} />
        <Stat label="Credits issued" value={a.credits.issued.toLocaleString("en-IN")} hint="Purchases, bonuses, subscriptions" />
        <Stat label="Credits consumed" value={a.credits.consumed.toLocaleString("en-IN")} hint={`${a.credits.refunded.toLocaleString("en-IN")} refunded`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">Daily generations</h2>
          <DailyGenerationsChart data={a.daily} />
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">Revenue & signups</h2>
          <RevenueChart data={a.daily} />
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">Monthly activity</h2>
          <MonthlyChart data={a.monthly} />
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">AI provider usage</h2>
          {a.providers.length === 0 ? (
            <p className="text-sm text-muted">No provider calls yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">Provider</th>
                  <th className="py-2 text-right font-medium">Jobs</th>
                  <th className="py-2 text-right font-medium">Failure rate</th>
                  <th className="py-2 text-right font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.providers.map((p) => (
                  <tr key={p.provider}>
                    <td className="py-2 capitalize">{p.provider}</td>
                    <td className="py-2 text-right tabular-nums">{p.jobs}</td>
                    <td className="py-2 text-right tabular-nums">{pct(p.failureRate)}</td>
                    <td className="py-2 text-right tabular-nums">${p.costUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className="mt-6 text-sm font-medium">Integrations</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(integrations).map(([k, v]) => (
              <Badge key={k} tone={v ? "ok" : "neutral"}>
                {k}: {v ? "configured" : "off"}
              </Badge>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
