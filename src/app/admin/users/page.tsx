import Link from "next/link";
import { adminUsersQuery, searchUsers } from "@/lib/queries/admin-users";
import { Badge, PageHeader } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = adminUsersQuery.parse({ q: sp.q || undefined, status: sp.status || undefined, role: sp.role || undefined, page: sp.page || 1 });
  const data = await searchUsers(q);
  const link = (page: number) => `/admin/users?${new URLSearchParams({ ...(q.q ? { q: q.q } : {}), ...(q.status ? { status: q.status } : {}), page: String(page) })}`;
  return (
    <div>
      <PageHeader title="Users" description={`${data.total.toLocaleString("en-IN")} accounts`} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <Input name="q" defaultValue={q.q} placeholder="Email, name, username or ID" className="max-w-xs" aria-label="Search users" />
        <Select name="status" defaultValue={q.status ?? ""} className="w-auto" aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DELETED">Deleted</option>
        </Select>
        <Select name="role" defaultValue={q.role ?? ""} className="w-auto" aria-label="Role">
          <option value="">Any role</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-panel-2 text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              <th className="px-4 py-3 text-right font-medium">Jobs</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-panel">
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-panel-2/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-violet">
                    {u.name}
                  </Link>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={u.status === "ACTIVE" ? "ok" : u.status === "SUSPENDED" ? "danger" : "neutral"}>{u.status.toLowerCase()}</Badge>
                    {u.role === "ADMIN" && <Badge tone="violet">admin</Badge>}
                    {!u.emailVerified && <Badge tone="warn">unverified</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{u.wallet?.balance ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u._count.jobs}</td>
                <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-muted">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {q.page > 1 ? <Link href={link(q.page - 1)} className="text-violet">Previous</Link> : <span />}
        <span className="text-muted">
          Page {q.page} of {data.pages}
        </span>
        {q.page < data.pages ? <Link href={link(q.page + 1)} className="text-violet">Next</Link> : <span />}
      </div>
    </div>
  );
}
