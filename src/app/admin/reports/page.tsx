import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { imageUrls } from "@/lib/images/access";
import { ReportActions } from "@/components/admin/report-actions";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: s } = await searchParams;
  const status: ReportStatus = s === "RESOLVED" || s === "DISMISSED" ? s : "OPEN";
  const reports = await db.contentReport.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { image: { select: { id: true, prompt: true, moderationStatus: true, visibility: true, userId: true, user: { select: { email: true } } } }, reporter: { select: { email: true } }, resolvedBy: { select: { email: true } } },
  });
  return (
    <div>
      <PageHeader title="Content reports" description="Images reported by several people are hidden automatically until reviewed." />
      <div className="mb-4 flex gap-3 text-sm">
        {(["OPEN", "RESOLVED", "DISMISSED"] as const).map((x) => (
          <Link key={x} href={`/admin/reports?status=${x}`} className={x === status ? "font-medium" : "text-muted"}>
            {x.toLowerCase()}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <EmptyState title="No reports here">Nothing to review right now.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-panel p-4 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrls(r.image.id).thumbUrl} alt="Reported image" className="size-32 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="danger">{r.reason.toLowerCase().replace("_", " ")}</Badge>
                  <Badge>{r.image.moderationStatus.toLowerCase()}</Badge>
                  <Badge>{r.image.visibility.toLowerCase()}</Badge>
                </div>
                {r.details && <p>“{r.details}”</p>}
                <p className="line-clamp-2 text-muted">Prompt: {r.image.prompt ?? "–"}</p>
                <p className="text-xs text-faint">
                  Creator <Link href={`/admin/users/${r.image.userId}`} className="hover:text-violet">{r.image.user.email}</Link> · reported by {r.reporter?.email ?? "deleted user"} · {formatDate(r.createdAt, true)}
                  {r.resolvedBy && ` · handled by ${r.resolvedBy.email}: ${r.resolution}`}
                </p>
              </div>
              {status === "OPEN" && <ReportActions reportId={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
