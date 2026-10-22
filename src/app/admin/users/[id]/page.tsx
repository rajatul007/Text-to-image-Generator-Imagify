import Link from "next/link";
import { notFound } from "next/navigation";
import { adminUserDetail } from "@/lib/queries/admin-users";
import { TX_LABELS } from "@/lib/queries/credits";
import { CreditDialog, SuspendDialog } from "@/components/admin/user-actions";
import { StatusBadge } from "@/components/generate/job-card";
import { Badge, PageHeader, Panel, Stat } from "@/components/ui/misc";
import { formatDate, formatInr } from "@/lib/utils";

export const metadata = { title: "User" };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await adminUserDetail(id);
  if (!d) notFound();
  const { user, jobs, ledger, orders } = d;
  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-violet hover:underline">
        All users
      </Link>
      <PageHeader
        title={user.name}
        description={
          <>
            {user.email} · @{user.profile?.username} · joined {formatDate(user.createdAt)} · {user.accounts.map((a) => a.provider).join(", ") || "email login"}
          </>
        }
        actions={
          user.status !== "DELETED" && (
            <>
              <CreditDialog userId={user.id} />
              {user.role !== "ADMIN" && <SuspendDialog userId={user.id} suspended={user.status === "SUSPENDED"} />}
            </>
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={user.status === "ACTIVE" ? "ok" : "danger"}>{user.status.toLowerCase()}</Badge>
        {user.role === "ADMIN" && <Badge tone="violet">admin</Badge>}
        <Badge tone={user.emailVerified ? "ok" : "warn"}>{user.emailVerified ? "email verified" : "email unverified"}</Badge>
        {user.suspendReason && <Badge tone="danger">Reason: {user.suspendReason}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Balance" value={user.wallet?.balance ?? 0} />
        <Stat label="Purchased" value={user.wallet?.lifetimePurchased ?? 0} />
        <Stat label="Spent" value={user.wallet?.lifetimeSpent ?? 0} />
        <Stat label="Images" value={user._count.images} hint={`${user._count.jobs} jobs`} />
      </div>
      <Panel className="overflow-x-auto p-5">
        <h2 className="font-display mb-3 font-semibold">Generation history</h2>
        <table className="w-full min-w-[640px] text-sm">
          <tbody className="divide-y divide-line">
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="py-2 pr-3">
                  <StatusBadge status={j.status} />
                </td>
                <td className="max-w-md truncate py-2 pr-3">{j.prompt}</td>
                <td className="py-2 pr-3 text-muted">{j.modelId}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{j.creditsCharged} cr</td>
                <td className="py-2 text-muted">{formatDate(j.createdAt, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="text-sm text-muted">No generations.</p>}
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">Credit ledger</h2>
          <ul className="divide-y divide-line text-sm">
            {ledger.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-2">
                <span>
                  {TX_LABELS[t.type]}
                  {t.reason && <span className="text-muted"> – {t.reason}</span>}
                  <span className="block text-xs text-faint">{formatDate(t.createdAt, true)}</span>
                </span>
                <span className="tabular-nums">
                  {t.amount > 0 ? "+" : ""}
                  {t.amount} → {t.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display mb-3 font-semibold">Payment orders</h2>
          <ul className="divide-y divide-line text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-2">
                <span>
                  {o.packageName} <span className="text-xs text-faint">{o.receipt}</span>
                </span>
                <span>
                  {formatInr(o.amountPaise)} <Badge>{o.status.toLowerCase()}</Badge>
                </span>
              </li>
            ))}
            {orders.length === 0 && <li className="py-2 text-muted">No orders.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
