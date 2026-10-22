import type { Visibility } from "@prisma/client";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { randomToken } from "../crypto";
import { deleteStoredImage } from "./process";

export async function getOwnedImage(userId: string, imageId: string) {
  const image = await db.generatedImage.findFirst({ where: { id: imageId, userId, deletedAt: null } });
  if (!image) throw notFound("Image");
  return image;
}

export async function updateImageVisibility(userId: string, imageId: string, patch: { visibility?: Visibility; showPrompt?: boolean; showCreator?: boolean }) {
  const image = await getOwnedImage(userId, imageId);
  if (patch.visibility === "PUBLIC" && image.moderationStatus !== "OK") {
    throw new AppError("FORBIDDEN", "This image was removed from the public gallery by a moderator and can't be republished.");
  }
  const updated = await db.generatedImage.update({
    where: { id: image.id },
    data: {
      ...patch,
      ...(patch.visibility === "PUBLIC" && image.visibility !== "PUBLIC" ? { publishedAt: new Date() } : {}),
    },
  });
  // Share links follow the creator's latest prompt/name visibility choices.
  if (patch.showPrompt !== undefined || patch.showCreator !== undefined) {
    await db.shareLink.updateMany({
      where: { imageId: image.id, revokedAt: null },
      data: { ...(patch.showPrompt !== undefined ? { showPrompt: patch.showPrompt } : {}), ...(patch.showCreator !== undefined ? { showCreator: patch.showCreator } : {}) },
    });
  }
  return updated;
}

/** Soft-deletes the record (history keeps the job), removes the files, and revokes all share links. */
export async function deleteImage(userId: string, imageId: string) {
  const image = await getOwnedImage(userId, imageId);
  await db.$transaction([
    db.generatedImage.update({ where: { id: image.id }, data: { deletedAt: new Date(), visibility: "PRIVATE" } }),
    db.shareLink.updateMany({ where: { imageId: image.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.favorite.deleteMany({ where: { imageId: image.id } }),
  ]);
  await deleteStoredImage(image);
}

export async function createShareLink(userId: string, imageId: string, opts: { showPrompt: boolean; showCreator: boolean }) {
  const image = await getOwnedImage(userId, imageId);
  if (image.moderationStatus === "REMOVED") throw new AppError("FORBIDDEN", "This image can't be shared.");
  const existing = await db.shareLink.findFirst({ where: { imageId: image.id, revokedAt: null } });
  if (existing) return db.shareLink.update({ where: { id: existing.id }, data: opts });
  // 192-bit random token – never a sequential/guessable id.
  return db.shareLink.create({ data: { token: randomToken(24), imageId: image.id, userId, ...opts } });
}

export async function revokeShareLinks(userId: string, imageId: string) {
  await getOwnedImage(userId, imageId);
  const res = await db.shareLink.updateMany({ where: { imageId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return res.count;
}

/** Resolves a share token. Returns null for unknown, revoked, deleted or moderated images. */
export async function resolveShareToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const link = await db.shareLink.findUnique({
    where: { token },
    include: { image: { include: { user: { select: { status: true, name: true, profile: { select: { username: true, displayName: true } } } }, job: true } } },
  });
  if (!link || link.revokedAt || link.image.deletedAt || link.image.moderationStatus !== "OK" || link.image.user.status !== "ACTIVE") return null;
  return link;
}
