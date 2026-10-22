import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Logs & audit" };
export const dynamic = "force-dynamic";

export default async function AdminLogs({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const kind = k === "audit" || k === "email" ? k : "errors";
  const [errors, audit, emails] = await Promise.all([
    kind === "errors" ? db.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }) : [],
    kind === "audit" ? db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { admin: { select: { email: true } } } }) : [],
    kind === "email" ? db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, omit: { devBody: true } }) : [],
  ]);
  return (
    <div>
      <PageHeader title="Logs & audit" description="Application errors, administrator actions, and email delivery." />
      <div className="mb-4 flex gap-3 text-sm">
        {[
          ["errors", "Application errors"],
          ["audit", "Audit log"],
          ["email", "Email delivery"],
        ].map(([v, l]) => (
          <Link key={v} href={`/admin/logs?kind=${v}`} className={kind === v ? "font-medium" : "text-muted"}>
            {l}
          </Link>
        ))}
      </div>
      <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-panel text-sm">
        {kind === "errors" &&
          errors.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex justify-between gap-3">
                <span>
                  <Badge tone="danger">{e.source}</Badge> {e.message}
                </span>
                <span className="shrink-0 text-xs text-faint">{formatDate(e.createdAt, true)}</span>
              </div>
              <pre className="mt-1 overflow-x-auto text-xs text-muted">{JSON.stringify(e.context)}</pre>
            </li>
          ))}
        {kind === "audit" &&
          audit.map((a) => (
            <li key={a.id} className="flex justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-medium">{a.action}</span> on {a.targetType} {a.targetId} by {a.admin.email}
                <pre className="mt-1 overflow-x-auto text-xs text-muted">{JSON.stringify(a.details)}</pre>
              </span>
              <span className="shrink-0 text-xs text-faint">{formatDate(a.createdAt, true)}</span>
            </li>
          ))}
        {kind === "email" &&
          emails.map((m) => (
            <li key={m.id} className="flex justify-between gap-3 px-4 py-3">
              <span>
                <Badge tone={m.status === "SENT" ? "ok" : m.status === "FAILED" ? "danger" : "neutral"}>{m.status.toLowerCase()}</Badge> {m.template} → {m.to}
                {m.error && <span className="block text-xs text-danger">{m.error}</span>}
              </span>
              <span className="shrink-0 text-xs text-faint">
                {m.provider} · {formatDate(m.createdAt, true)}
              </span>
            </li>
          ))}
        {((kind === "errors" && errors.length === 0) || (kind === "audit" && audit.length === 0) || (kind === "email" && emails.length === 0)) && <li className="px-4 py-6 text-muted">Nothing logged yet.</li>}
      </ul>
    </div>
  );
}
