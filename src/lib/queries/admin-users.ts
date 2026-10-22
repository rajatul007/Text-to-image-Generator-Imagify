import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";

export const adminUsersQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export async function searchUsers(q: z.infer<typeof adminUsersQuery>) {
  const where: Prisma.UserWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.role ? { role: q.role } : {}),
    ...(q.q
      ? { OR: [{ email: { contains: q.q, mode: "insensitive" } }, { name: { contains: q.q, mode: "insensitive" } }, { id: q.q }, { profile: { username: { contains: q.q.toLowerCase() } } }] }
      : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * 25,
      take: 25,
      select: { id: true, email: true, name: true, role: true, status: true, emailVerified: true, createdAt: true, lastLoginAt: true, wallet: { select: { balance: true } }, _count: { select: { jobs: true, images: true } } },
    }),
  ]);
  return { total, page: q.page, pages: Math.max(1, Math.ceil(total / 25)), items: users };
}

export async function adminUserDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true, status: true, emailVerified: true, createdAt: true, lastLoginAt: true, suspendReason: true, suspendedAt: true,
      profile: { select: { username: true, displayName: true } },
      wallet: true,
      accounts: { select: { provider: true } },
      _count: { select: { jobs: true, images: true, paymentOrders: true } },
    },
  });
  if (!user) return null;
  const [jobs, ledger, orders] = await Promise.all([
    db.generationJob.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 25, include: { images: { where: { deletedAt: null }, select: { id: true } } } }),
    db.creditTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.paymentOrder.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return { user, jobs, ledger, orders };
}
