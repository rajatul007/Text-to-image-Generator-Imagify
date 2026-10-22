import sharp from "sharp";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import { RULES } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";

export const POST = route({ rateLimit: RULES.upload }, async ({ user, req }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Choose an image to upload");
  if (file.size > 5 * 1024 * 1024) throw new AppError("PAYLOAD_TOO_LARGE", "Avatar must be smaller than 5 MB");
  let out: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) throw new Error("format");
    out = await sharp(input).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA", "Only PNG, JPEG or WebP images are supported");
  }
  const key = `avatars/${user.id}/${randomToken(12)}.webp`;
  await storage().put(key, out, "image/webp");
  const prev = await db.profile.findUnique({ where: { userId: user.id }, select: { avatarKey: true } });
  await db.profile.update({ where: { userId: user.id }, data: { avatarKey: key } });
  if (prev?.avatarKey) await storage().delete(prev.avatarKey).catch(() => undefined);
  return { avatarUrl: `/api/avatar/${user.id}?v=${Date.now()}` };
});

export const DELETE = route({}, async ({ user }) => {
  const prev = await db.profile.findUnique({ where: { userId: user.id }, select: { avatarKey: true } });
  await db.profile.update({ where: { userId: user.id }, data: { avatarKey: null } });
  if (prev?.avatarKey) await storage().delete(prev.avatarKey).catch(() => undefined);
  return { ok: true };
});
