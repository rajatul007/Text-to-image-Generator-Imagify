import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

/**
 * Moderation actions:
 *  - dismiss: report closed, image restored to the gallery if it was auto-hidden
 *  - remove: image removed from public gallery (owner keeps their private copy), all open reports resolved
 */
export const PATCH = route({ auth: "admin" }, async ({ user, params, json, ip }) => {
  const { action, note } = await json(z.object({ action: z.enum(["dismiss", "remove"]), note: z.string().trim().max(500).optional() }));
  const report = await db.contentReport.findUnique({ where: { id: params.id }, include: { image: true } });
  if (!report) throw notFound("Report");
  await db.$transaction(async (tx) => {
    if (action === "remove") {
      await tx.generatedImage.update({ where: { id: report.imageId }, data: { moderationStatus: "REMOVED", visibility: "PRIVATE" } });
      await tx.shareLink.updateMany({ where: { imageId: report.imageId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.contentReport.updateMany({ where: { imageId: report.imageId, status: "OPEN" }, data: { status: "RESOLVED", resolvedById: user.id, resolution: note ?? "Removed", resolvedAt: new Date() } });
    } else {
      await tx.contentReport.update({ where: { id: report.id }, data: { status: "DISMISSED", resolvedById: user.id, resolution: note ?? "Dismissed", resolvedAt: new Date() } });
      const stillOpen = await tx.contentReport.count({ where: { imageId: report.imageId, status: "OPEN" } });
      if (stillOpen === 0 && report.image.moderationStatus === "HIDDEN") await tx.generatedImage.update({ where: { id: report.imageId }, data: { moderationStatus: "OK" } });
    }
    await audit(user.id, `report.${action}`, { type: "ContentReport", id: report.id }, { imageId: report.imageId, note: note ?? null }, ip, tx);
  });
  if (action === "remove") {
    void notify({ userId: report.image.userId, type: "MODERATION", title: "An image was removed from Explore", body: "One of your public images was removed from the community gallery for violating our content policy. It remains in your private gallery.", link: `/creations` });
  }
  return { ok: true };
});
