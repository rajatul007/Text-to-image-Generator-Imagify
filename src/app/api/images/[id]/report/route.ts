import { z } from "zod";
import { route } from "@/lib/api";
import { db, isUniqueViolation } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { RULES } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { isPubliclyVisible } from "@/lib/images/access";
import { resolveShareToken } from "@/lib/images/manage";

const schema = z.object({
  reason: z.enum(["SEXUAL_CONTENT", "VIOLENCE", "HATE", "HARASSMENT", "COPYRIGHT", "SPAM", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
  shareToken: z.string().max(64).optional(),
});

/** Anyone signed in can report a public (or shared) image. Repeated reports auto-hide it pending review. */
export const POST = route({ rateLimit: RULES.report }, async ({ user, params, json }) => {
  const input = await json(schema);
  const image = await db.generatedImage.findUnique({ where: { id: params.id } });
  const viaShare = input.shareToken ? (await resolveShareToken(input.shareToken))?.imageId === params.id : false;
  if (!image || (!isPubliclyVisible(image) && !viaShare)) throw notFound("Image");
  if (image.userId === user.id) throw new AppError("BAD_REQUEST", "You can't report your own image");
  try {
    await db.contentReport.create({ data: { imageId: image.id, reporterId: user.id, reason: input.reason, details: input.details } });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: true, message: "You've already reported this image. Our team will review it." };
    throw err;
  }
  const { reportAutoHideThreshold } = await getSettings();
  const open = await db.contentReport.count({ where: { imageId: image.id, status: "OPEN" } });
  if (open >= reportAutoHideThreshold) await db.generatedImage.updateMany({ where: { id: image.id, moderationStatus: "OK" }, data: { moderationStatus: "HIDDEN" } });
  return { ok: true, message: "Thanks – our moderators will review this image." };
});
