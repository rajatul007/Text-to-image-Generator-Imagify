import Link from "next/link";
import type { JobStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminAnalytics } from "@/lib/queries/admin";
import { DailyGenerationsChart } from "@/components/admin/charts";
import { StatusBadge } from "@/components/generate/job-card";
import { PageHeader, Panel, Stat } from "@/components/ui/misc";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Generations" };
export const dynamic = "force-dynamic";

const STATUSES = ["QUEUED", "PROCESSING", "UPLOADING", "COMPLETED", "FAILED", "CANCELLED"] as const;

export default async function AdminGenerations({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as JobStatus) ? (sp.status as JobStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.GenerationJobWhereInput = { ...(status ? { status } : {}), ...(sp.provider ? { provider: sp.provider } : {}) };
  const [a, total, jobs, byModel] = await Promise.all([
    adminAnalytics(),
    db.generationJob.count({ where }),
    db.generationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { user: { select: { email: true, id: true } } } }),
    db.generationJob.groupBy({ by: ["modelId", "status"], _count: { _all: true } }),
  ]);
  const models = [...new Set(byModel.map((b) => b.modelId))].map((m) => {
    const rows = byModel.filter((b) => b.modelId === m);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const failed = rows.find((r) => r.status === "FAILED")?._count._all ?? 0;
    const ok = rows.find((r) => r.status === "COMPLETED")?._count._all ?? 0;
    return { m, total, failed, rate: ok + failed ? failed / (ok + failed) : 0 };
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Generations" description="Job outcomes, failure rates and the raw job log." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total jobs" value={a.generations.total} />
        <Stat label="Completed" value={a.generations.completed} />
        <Stat label="Failed (refunded)" value={a.generations.failed} />
        <Stat label="Failure rate" value={`${(a.generations.failureRate * 100).toFixed(1)}%`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">Last 30 days</h2>
          <DailyGenerationsChart data={a.daily} />
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">By model</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {models.map((r) => (
                <tr key={r.m}>
                  <td className="py-2">{r.m}</td>
                  <td className="py-2 text-right tabular-nums">{r.total}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{(r.rate * 100).toFixed(1)}% failed</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <form className="flex gap-2" method="get">
        <Select name="status" defaultValue={status ?? ""} className="w-auto" aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </Select>
        <Select name="provider" defaultValue={sp.provider ?? ""} className="w-auto" aria-label="Provider">
          <option value="">All providers</option>
          {["stability", "openai", "replicate", "clipdrop"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-panel-2 text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Type / model</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 text-right font-medium">Credits</th>
              <th className="px-4 py-3 text-right font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-panel">
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2.5">
                  <StatusBadge status={j.status} />
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/users/${j.user.id}`} className="hover:text-violet">
                    {j.user.email}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {j.type.toLowerCase()} · {j.modelId}
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 text-xs text-danger" title={j.errorMessage ?? ""}>
                  {j.errorCode ? `${j.errorCode}: ${j.errorMessage}` : ""}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{j.creditsCharged}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {j.attempts}/{j.maxAttempts}
                </td>
                <td className="px-4 py-2.5 text-muted">{formatDate(j.createdAt, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        {total} jobs · page {page} of {Math.max(1, Math.ceil(total / 30))}{" "}
        {page * 30 < total && (
          <Link className="text-violet" href={`/admin/generations?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}>
            Next page
          </Link>
        )}
      </p>
    </div>
  );
}
