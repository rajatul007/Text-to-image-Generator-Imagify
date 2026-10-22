import { route } from "@/lib/api";
import { db, isUniqueViolation } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { isPubliclyVisible } from "@/lib/images/access";

export const POST = route({}, async ({ user, params }) => {
  const image = await db.generatedImage.findUnique({ where: { id: params.id } });
  if (!image || !isPubliclyVisible(image)) throw notFound("Image");
  try {
    await db.$transaction([
      db.imageInteraction.create({ data: { userId: user.id, imageId: image.id, type: "LIKE" } }),
      db.generatedImage.update({ where: { id: image.id }, data: { likeCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  const fresh = await db.generatedImage.findUniqueOrThrow({ where: { id: image.id }, select: { likeCount: true } });
  return { liked: true, likeCount: fresh.likeCount };
});

export const DELETE = route({}, async ({ user, params }) => {
  const removed = await db.imageInteraction.deleteMany({ where: { userId: user.id, imageId: params.id, type: "LIKE" } });
  if (removed.count > 0) await db.generatedImage.updateMany({ where: { id: params.id, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
  const fresh = await db.generatedImage.findUnique({ where: { id: params.id }, select: { likeCount: true } });
  return { liked: false, likeCount: fresh?.likeCount ?? 0 };
});
