import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { CATEGORY_IDS } from "@/data/prompt-categories";

export const libraryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  sort: z.enum(["trending", "recent", "featured"]).default("trending"),
  favorites: z.enum(["1", "0"]).optional(),
  community: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type LibraryQuery = z.infer<typeof libraryQuerySchema>;

export async function listPromptTemplates(userId: string | null, q: LibraryQuery) {
  const where: Prisma.PromptTemplateWhereInput = {
    status: "PUBLISHED",
    isPublic: true,
    ...(q.category ? { category: q.category } : {}),
    ...(q.sort === "featured" ? { featured: true } : {}),
    ...(q.community === "1" ? { authorId: { not: null } } : {}),
    ...(q.favorites === "1" && userId ? { favorites: { some: { userId } } } : {}),
    ...(q.q
      ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { prompt: { contains: q.q, mode: "insensitive" } }, { tags: { has: q.q.toLowerCase() } }] }
      : {}),
  };
  const orderBy: Prisma.PromptTemplateOrderByWithRelationInput[] =
    q.sort === "recent" ? [{ createdAt: "desc" }] : q.sort === "featured" ? [{ usageCount: "desc" }] : [{ usageCount: "desc" }, { createdAt: "desc" }];
  const [total, rows] = await Promise.all([
    db.promptTemplate.count({ where }),
    db.promptTemplate.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        author: { select: { profile: { select: { username: true, displayName: true } } } },
        ...(userId ? { favorites: { where: { userId }, select: { id: true } } } : {}),
      },
    }),
  ]);
  return {
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
    items: rows.map((t) => ({
      id: t.id,
      title: t.title,
      prompt: t.prompt,
      negativePrompt: t.negativePrompt,
      category: t.category,
      style: t.style,
      aspectRatio: t.aspectRatio,
      previewImageUrl: t.previewImageUrl,
      tags: t.tags,
      featured: t.featured,
      usageCount: t.usageCount,
      createdAt: t.createdAt.toISOString(),
      author: t.author?.profile ? { username: t.author.profile.username, displayName: t.author.profile.displayName } : null,
      favorite: Boolean((t as { favorites?: unknown[] }).favorites?.length),
    })),
  };
}
export type PromptTemplateItem = Awaited<ReturnType<typeof listPromptTemplates>>["items"][number];
