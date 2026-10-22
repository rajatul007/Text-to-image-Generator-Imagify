import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { serializeOwnImage } from "@/lib/images/access";
import { deleteImage, updateImageVisibility } from "@/lib/images/manage";

/** Owner view: full metadata + version lineage (for the editor and before/after comparison). */
export const GET = route({}, async ({ user, params }) => {
  const image = await db.generatedImage.findFirst({
    where: { id: params.id, userId: user.id, deletedAt: null },
    include: { job: true, favorites: { where: { userId: user.id } }, shareLinks: { where: { revokedAt: null }, take: 1 }, version: true },
  });
  if (!image) throw notFound("Image");
  const rootId = image.version?.rootImageId ?? image.id;
  const [root, versions] = await Promise.all([
    rootId === image.id ? image : db.generatedImage.findFirst({ where: { id: rootId, userId: user.id, deletedAt: null }, include: { job: true } }),
    db.imageVersion.findMany({
      where: { rootImageId: rootId, image: { deletedAt: null } },
      orderBy: { versionNumber: "asc" },
      include: { image: { include: { job: true } } },
    }),
  ]);
  const parent = image.parentId ? await db.generatedImage.findFirst({ where: { id: image.parentId, userId: user.id, deletedAt: null }, include: { job: true } }) : null;
  return {
    image: serializeOwnImage(image, { favorite: image.favorites.length > 0, shareToken: image.shareLinks[0]?.token ?? null }),
    parent: parent ? serializeOwnImage(parent) : null,
    root: root ? serializeOwnImage(root) : null,
    versions: versions.map((v) => ({ versionNumber: v.versionNumber, operation: v.operation, instruction: v.instruction, parentImageId: v.parentImageId, createdAt: v.createdAt.toISOString(), image: serializeOwnImage(v.image) })),
  };
});

export const PATCH = route({}, async ({ user, params, json }) => {
  const patch = await json(z.object({ visibility: z.enum(["PRIVATE", "PUBLIC"]).optional(), showPrompt: z.boolean().optional(), showCreator: z.boolean().optional() }));
  if (patch.visibility === "PUBLIC" && !user.emailVerified) {
    const { AppError } = await import("@/lib/errors");
    throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before publishing images");
  }
  const image = await updateImageVisibility(user.id, params.id, patch);
  return { image: serializeOwnImage(image) };
});

export const DELETE = route({}, async ({ user, params }) => {
  await deleteImage(user.id, params.id);
  return { ok: true };
});
