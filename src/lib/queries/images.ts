import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { serializeOwnImage, serializePublicImage } from "../images/access";

export const creationsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  style: z.string().max(40).optional(),
  model: z.string().max(60).optional(),
  origin: z.enum(["GENERATED", "UPLOADED", "EDITED"]).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).optional(),
  favorites: z.enum(["1", "0"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type CreationsQuery = z.infer<typeof creationsQuerySchema>;

export async function listCreations(userId: string, q: CreationsQuery) {
  const where: Prisma.GeneratedImageWhereInput = {
    userId,
    deletedAt: null,
    ...(q.style ? { style: q.style } : {}),
    ...(q.model ? { modelId: q.model } : {}),
    ...(q.origin ? { origin: q.origin } : {}),
    ...(q.visibility ? { visibility: q.visibility } : {}),
    ...(q.favorites === "1" ? { favorites: { some: { userId } } } : {}),
    ...(q.q ? { prompt: { contains: q.q, mode: "insensitive" } } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86_400_000) } : {}) } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.generatedImage.count({ where }),
    db.generatedImage.findMany({
      where,
      orderBy: { createdAt: q.sort === "oldest" ? "asc" : "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        job: true,
        favorites: { where: { userId }, select: { id: true } },
        shareLinks: { where: { revokedAt: null }, select: { token: true }, take: 1 },
      },
    }),
  ]);
  return {
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
    items: rows.map((r) => serializeOwnImage(r, { favorite: r.favorites.length > 0, shareToken: r.shareLinks[0]?.token ?? null })),
  };
}

export const exploreQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  style: z.string().max(40).optional(),
  model: z.string().max(60).optional(),
  sort: z.enum(["trending", "recent", "top"]).default("trending"),
  creator: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

/** Public gallery. Visibility is enforced HERE (server-side): only PUBLIC, non-moderated, non-deleted images from active accounts. */
export function publicImageWhere(extra: Prisma.GeneratedImageWhereInput = {}): Prisma.GeneratedImageWhereInput {
  return { visibility: "PUBLIC", moderationStatus: "OK", deletedAt: null, user: { status: "ACTIVE" }, ...extra };
}

export async function listExplore(viewerId: string | null, q: ExploreQuery) {
  const where = publicImageWhere({
    ...(q.style ? { style: q.style } : {}),
    ...(q.model ? { modelId: q.model } : {}),
    ...(q.creator ? { showCreator: true, user: { status: "ACTIVE", profile: { username: q.creator } } } : {}),
    // Prompt search only matches images whose creators chose to show their prompt.
    ...(q.q ? { showPrompt: true, prompt: { contains: q.q, mode: "insensitive" } } : {}),
  });
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const orderBy: Prisma.GeneratedImageOrderByWithRelationInput[] =
    q.sort === "recent" ? [{ publishedAt: "desc" }] : q.sort === "top" ? [{ likeCount: "desc" }, { publishedAt: "desc" }] : [{ likeCount: "desc" }, { publishedAt: "desc" }];
  const trendingWhere = q.sort === "trending" ? { ...where, publishedAt: { gte: weekAgo } } : where;
  let [total, rows] = await Promise.all([
    db.generatedImage.count({ where: trendingWhere }),
    db.generatedImage.findMany({
      where: trendingWhere,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { name: true, profile: { select: { username: true, displayName: true, avatarKey: true } } } } },
    }),
  ]);
  // Trending falls back to all-time when the last week is quiet.
  if (q.sort === "trending" && total < q.pageSize && q.page === 1) {
    [total, rows] = await Promise.all([
      db.generatedImage.count({ where }),
      db.generatedImage.findMany({ where, orderBy, take: q.pageSize, include: { user: { select: { name: true, profile: { select: { username: true, displayName: true, avatarKey: true } } } } } }),
    ]);
  }
  const liked = viewerId
    ? new Set((await db.imageInteraction.findMany({ where: { userId: viewerId, type: "LIKE", imageId: { in: rows.map((r) => r.id) } }, select: { imageId: true } })).map((l) => l.imageId))
    : new Set<string>();
  return {
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
    items: rows.map((r) => serializePublicImage(r, { liked: liked.has(r.id) })),
  };
}
