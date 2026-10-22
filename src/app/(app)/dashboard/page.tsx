import Link from "next/link";
import { Coins, Images, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { startOfDayDaysAgo } from "@/lib/time";
import { walletSummary, TX_LABELS } from "@/lib/queries/credits";
import { getActiveSubscription } from "@/lib/payments/subscriptions";
import { getSettings } from "@/lib/settings";
import { imageUrls } from "@/lib/images/access";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { Alert, EmptyState, PageHeader, Panel, Stat } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/generate/job-card";
import { cn, formatDate, plural, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function ImageStrip({ images, empty }: { images: { id: string; width: number; height: number; prompt: string | null }[]; empty: string }) {
  if (images.length === 0) return <p className="py-6 text-sm text-muted">{empty}</p>;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {images.map((img) => (
        <li key={img.id}>
          <Link href={`/creations?open=${img.id}`} className="block overflow-hidden rounded-lg border border-line bg-panel-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrls(img.id).thumbUrl} alt={img.prompt?.slice(0, 80) ?? "Image"} className="aspect-square w-full object-cover" loading="lazy" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  const since = startOfDayDaysAgo(13);
  const [wallet, settings, sub, byStatus, imagesCount, publicCount, recentImages, favorites, recentJobs, recentTx, daily] = await Promise.all([
    walletSummary(user.id),
    getSettings(),
    getActiveSubscription(user.id),
    db.generationJob.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
    db.generatedImage.count({ where: { userId: user.id, deletedAt: null } }),
    db.generatedImage.count({ where: { userId: user.id, deletedAt: null, visibility: "PUBLIC" } }),
    db.generatedImage.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, width: true, height: true, prompt: true } }),
    db.favorite.findMany({ where: { userId: user.id, image: { deletedAt: null } }, orderBy: { createdAt: "desc" }, take: 6, include: { image: { select: { id: true, width: true, height: true, prompt: true } } } }),
    db.generationJob.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6, include: { model: { select: { displayName: true } } } }),
    db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.$queryRaw<{ day: Date; completed: bigint; failed: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
        count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
        count(*) FILTER (WHERE status = 'FAILED') AS failed
      FROM "GenerationJob" WHERE "userId" = ${user.id} AND "createdAt" >= ${since} GROUP BY 1`,
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const chart = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000);
    const row = daily.find((r) => new Date(r.day).toDateString() === d.toDateString());
    return { day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), completed: Number(row?.completed ?? 0), failed: Number(row?.failed ?? 0) };
  });
  const low = wallet.balance < settings.lowCreditThreshold;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Your studio at a glance."
        actions={
          <Button asChild>
            <Link href="/generate">
              <Sparkles className="size-4" /> Quick generate
            </Link>
          </Button>
        }
      />
      {low && user.emailVerified && (
        <Alert
          tone="warn"
          title={`You have ${plural(wallet.balance, "credit")} left`}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/credits">Top up credits</Link>
            </Button>
          }
        >
          Top up to keep generating without interruptions.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credit balance" value={wallet.balance.toLocaleString("en-IN")} hint={`${wallet.lifetimeSpent.toLocaleString("en-IN")} spent all-time`} className={cn(low && "border-warn/40")} />
        <Stat label="Images" value={imagesCount.toLocaleString("en-IN")} hint={`${publicCount} public`} />
        <Stat label="Successful generations" value={count("COMPLETED").toLocaleString("en-IN")} hint={`${count("FAILED")} failed · refunded`} />
        <Stat label="Plan" value={sub ? sub.plan.name : "Free + credit packs"} hint={sub?.currentPeriodEnd ? `${sub.cancelAtPeriodEnd ? "Ends" : "Renews"} ${formatDate(sub.currentPeriodEnd)}` : `${wallet.lifetimePurchased.toLocaleString("en-IN")} credits purchased`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="p-5">
          <h2 className="font-display mb-3 text-lg font-semibold">Generation activity</h2>
          <ActivityChart data={chart} />
        </Panel>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent activity</h2>
            <Link href="/history" className="text-sm text-violet hover:underline">
              History
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <p className="py-6 text-sm text-muted">Nothing yet – your generations will show up here.</p>
          ) : (
            <ul className="space-y-3">
              {recentJobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{j.prompt}</p>
                    <p className="text-xs text-faint">
                      {j.model.displayName} · {timeAgo(j.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent images</h2>
          <Link href="/creations" className="text-sm text-violet hover:underline">
            All creations
          </Link>
        </div>
        {recentImages.length === 0 ? (
          <EmptyState icon={<Images className="size-5" />} title="No images yet" action={<Button asChild><Link href="/generate">Create your first image</Link></Button>}>
            Everything you generate is saved here privately.
          </EmptyState>
        ) : (
          <ImageStrip images={recentImages} empty="" />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Favorites</h2>
            <Link href="/favorites" className="text-sm text-violet hover:underline">
              View all
            </Link>
          </div>
          <ImageStrip images={favorites.map((f) => f.image)} empty="Tap the heart on any image to keep it here." />
        </Panel>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent transactions</h2>
            <Link href="/transactions" className="text-sm text-violet hover:underline">
              All transactions
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <p className="py-6 text-sm text-muted">No credit activity yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentTx.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{TX_LABELS[t.type]}</p>
                    <p className="text-xs text-faint">{timeAgo(t.createdAt)}</p>
                  </div>
                  <span className={cn("flex items-center gap-1 font-medium tabular-nums", t.amount >= 0 ? "text-ok" : "text-text")}>
                    <Coins className="size-3.5" /> {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
