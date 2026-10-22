import { route } from "@/lib/api";
import { db, isUniqueViolation } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { canViewImage } from "@/lib/images/access";

export const POST = route({}, async ({ user, params }) => {
  const image = await db.generatedImage.findUnique({ where: { id: params.id } });
  if (!image || !canViewImage(image, user)) throw notFound("Image");
  try {
    await db.favorite.create({ data: { userId: user.id, imageId: image.id } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  return { favorite: true };
});

export const DELETE = route({}, async ({ user, params }) => {
  await db.favorite.deleteMany({ where: { userId: user.id, imageId: params.id } });
  return { favorite: false };
});
