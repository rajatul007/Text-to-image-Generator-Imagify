import { db } from "../db";

interface DayRow {
  day: Date;
  completed: bigint;
  failed: bigint;
}

export async function adminAnalytics() {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [
    totalUsers,
    verifiedUsers,
    suspendedUsers,
    activeUsers,
    jobStatus,
    creditsIssued,
    creditsCharged,
    creditsRefunded,
    revenue,
    refunds,
    providerUsage,
    daily,
    signups,
    revenueDaily,
    monthly,
    openReports,
    failedWebhooks,
  ] = await Promise.all([
    db.user.count({ where: { status: { not: "DELETED" } } }),
    db.user.count({ where: { status: { not: "DELETED" }, emailVerified: { not: null } } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.user.count({ where: { status: "ACTIVE", OR: [{ lastLoginAt: { gte: since30 } }, { jobs: { some: { createdAt: { gte: since30 } } } }] } }),
    db.generationJob.groupBy({ by: ["status"], _count: { _all: true } }),
    db.creditTransaction.aggregate({ where: { amount: { gt: 0 }, type: { not: "REFUND" } }, _sum: { amount: true } }),
    db.creditTransaction.aggregate({ where: { type: "GENERATION_CHARGE" }, _sum: { amount: true } }),
    db.creditTransaction.aggregate({ where: { type: "REFUND" }, _sum: { amount: true } }),
    db.paymentOrder.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { amountPaise: true }, _count: { _all: true } }),
    db.paymentOrder.aggregate({ _sum: { refundedPaise: true } }),
    db.generationJob.groupBy({ by: ["provider", "status"], _count: { _all: true }, _sum: { providerCostUsd: true } }),
    db.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
             count(*) FILTER (WHERE status = 'FAILED') AS failed
      FROM "GenerationJob" WHERE "createdAt" >= ${since30}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count FROM "User"
      WHERE "createdAt" >= ${since30} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ day: Date; paise: bigint }[]>`
      SELECT date_trunc('day', "paidAt") AS day, sum("amountPaise") AS paise FROM "PaymentOrder"
      WHERE "paidAt" >= ${since30} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ month: Date; generations: bigint; users: bigint }[]>`
      SELECT m.month,
        (SELECT count(*) FROM "GenerationJob" j WHERE date_trunc('month', j."createdAt") = m.month) AS generations,
        (SELECT count(DISTINCT j."userId") FROM "GenerationJob" j WHERE date_trunc('month', j."createdAt") = m.month) AS users
      FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS m(month)
      ORDER BY 1`,
    db.contentReport.count({ where: { status: "OPEN" } }),
    db.paymentWebhookEvent.count({ where: { status: "FAILED" } }),
  ]);

  const statusCount = (s: string) => jobStatus.find((j) => j.status === s)?._count._all ?? 0;
  const totalJobs = jobStatus.reduce((a, j) => a + j._count._all, 0);
  const completed = statusCount("COMPLETED");
  const failed = statusCount("FAILED");

  const providers = new Map<string, { provider: string; jobs: number; failed: number; costUsd: number }>();
  for (const row of providerUsage) {
    const p = providers.get(row.provider) ?? { provider: row.provider, jobs: 0, failed: 0, costUsd: 0 };
    p.jobs += row._count._all;
    if (row.status === "FAILED") p.failed += row._count._all;
    p.costUsd += Number(row._sum.providerCostUsd ?? 0);
    providers.set(row.provider, p);
  }

  // Fill missing days so charts have continuous axes.
  const days: { day: string; completed: number; failed: number; signups: number; revenue: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const g = daily.find((r) => r.day.toISOString().slice(0, 10) === key);
    const s = signups.find((r) => r.day.toISOString().slice(0, 10) === key);
    const r = revenueDaily.find((x) => x.day.toISOString().slice(0, 10) === key);
    days.push({ day: key.slice(5), completed: Number(g?.completed ?? 0), failed: Number(g?.failed ?? 0), signups: Number(s?.count ?? 0), revenue: Number(r?.paise ?? 0) / 100 });
  }

  return {
    users: { total: totalUsers, verified: verifiedUsers, suspended: suspendedUsers, active30d: activeUsers },
    generations: { total: totalJobs, completed, failed, inFlight: statusCount("QUEUED") + statusCount("PROCESSING") + statusCount("UPLOADING"), cancelled: statusCount("CANCELLED"), failureRate: completed + failed > 0 ? failed / (completed + failed) : 0 },
    credits: { issued: creditsIssued._sum.amount ?? 0, consumed: -(creditsCharged._sum.amount ?? 0) - (creditsRefunded._sum.amount ?? 0), refunded: creditsRefunded._sum.amount ?? 0 },
    payments: { revenuePaise: revenue._sum.amountPaise ?? 0, paidOrders: revenue._count._all, refundedPaise: refunds._sum.refundedPaise ?? 0 },
    providers: [...providers.values()].map((p) => ({ ...p, failureRate: p.jobs ? p.failed / p.jobs : 0, costUsd: Math.round(p.costUsd * 100) / 100 })),
    daily: days,
    monthly: monthly.map((m) => ({ month: m.month.toISOString().slice(0, 7), generations: Number(m.generations), activeUsers: Number(m.users) })),
    openReports,
    failedWebhooks,
  };
}
export type AdminAnalytics = Awaited<ReturnType<typeof adminAnalytics>>;
