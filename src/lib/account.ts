import { db } from "./db";
import { AppError } from "./errors";
import { logger } from "./logger";
import { storage } from "./storage";
import { razorpay, razorpayConfigured } from "./payments/razorpay";

/**
 * Deletes a user's account.
 * Personal data, images, sessions and social data are removed. Financial records (credit ledger and payment
 * orders) are retained in anonymised form because tax/accounting rules require them; they no longer contain
 * the user's name or email.
 */
export async function deleteAccount(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user || user.status === "DELETED") throw new AppError("NOT_FOUND", "Account not found");

  const subs = await db.subscription.findMany({ where: { userId, status: { in: ["ACTIVE", "AUTHENTICATED", "PENDING", "HALTED"] } } });
  for (const sub of subs) {
    if (!razorpayConfigured()) throw new AppError("CONFLICT", "Please contact support to cancel your subscription before deleting your account.");
    await razorpay.cancelSubscription(sub.razorpaySubscriptionId, false);
    await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
  }

  const images = await db.generatedImage.findMany({ where: { userId }, select: { id: true, storageKey: true, thumbKey: true } });
  await db.$transaction(async (tx) => {
    await tx.generationJob.updateMany({ where: { userId, status: "QUEUED" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.shareLink.deleteMany({ where: { userId } });
    await tx.favorite.deleteMany({ where: { userId } });
    await tx.promptFavorite.deleteMany({ where: { userId } });
    await tx.imageInteraction.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.promptEnhancement.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { userId } });
    await tx.promptTemplate.updateMany({ where: { authorId: userId }, data: { authorId: null, isPublic: false, status: "ARCHIVED" } });
    await tx.generatedImage.updateMany({ where: { userId }, data: { deletedAt: new Date(), visibility: "PRIVATE", prompt: null } });
    await tx.generationJob.updateMany({ where: { userId }, data: { prompt: "[deleted]", enhancedPrompt: null, finalPrompt: "[deleted]", negativePrompt: null } });
    if (user.profile) await tx.profile.update({ where: { userId }, data: { username: `deleted_${userId.slice(-10)}`, displayName: "Deleted user", bio: null, avatarKey: null } });
    await tx.user.update({
      where: { id: userId },
      data: { status: "DELETED", deletedAt: new Date(), email: `deleted+${userId}@deleted.invalid`, name: "Deleted user", passwordHash: null },
    });
  });

  const s = storage();
  for (const img of images) {
    await s.delete(img.storageKey).catch(() => undefined);
    if (img.thumbKey) await s.delete(img.thumbKey).catch(() => undefined);
  }
  if (user.profile?.avatarKey) await s.delete(user.profile.avatarKey).catch(() => undefined);
  logger.info("account deleted", { userId, images: images.length });
}
