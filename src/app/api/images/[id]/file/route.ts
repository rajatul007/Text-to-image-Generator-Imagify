import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { canViewImage, isPubliclyVisible } from "@/lib/images/access";
import { storage } from "@/lib/storage";

/**
 * Streams image bytes after an access check on EVERY request. Private images are only served to their owner
 * (or administrators). Storage objects are never publicly addressable.
 */
export const GET = route({ auth: "optional" }, async ({ user, params, req }) => {
  const image = await db.generatedImage.findUnique({ where: { id: params.id }, include: { user: { select: { status: true } } } });
  if (!image || !canViewImage(image, user) || (image.userId !== user?.id && image.user.status !== "ACTIVE" && user?.role !== "ADMIN")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const thumb = req.nextUrl.searchParams.get("variant") === "thumb" && image.thumbKey;
  const download = req.nextUrl.searchParams.get("download") === "1";
  const ext = image.mimeType === "image/png" ? "png" : "webp";
  return storage().serve(thumb ? image.thumbKey! : image.storageKey, thumb ? "image/webp" : image.mimeType, {
    download: download ? `text-to-image-${image.id}.${ext}` : undefined,
    cacheSeconds: isPubliclyVisible(image) ? 300 : 0,
  });
});
