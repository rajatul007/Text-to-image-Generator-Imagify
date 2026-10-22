import { route } from "@/lib/api";
import { db, isUniqueViolation } from "@/lib/db";
import { notFound } from "@/lib/errors";

export const POST = route({}, async ({ user, params }) => {
  const t = await db.promptTemplate.findFirst({ where: { id: params.id, status: "PUBLISHED" }, select: { id: true } });
  if (!t) throw notFound("Prompt");
  try {
    await db.promptFavorite.create({ data: { userId: user.id, templateId: t.id } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  return { favorite: true };
});

export const DELETE = route({}, async ({ user, params }) => {
  await db.promptFavorite.deleteMany({ where: { userId: user.id, templateId: params.id } });
  return { favorite: false };
});
