import sharp, { type Metadata } from "sharp";
import { randomToken } from "../crypto";
import { AppError } from "../errors";
import { storage } from "../storage";

const ALLOWED_INPUT = new Set(["png", "jpeg", "webp"]);

export interface StoredImage {
  storageKey: string;
  thumbKey: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Validates image bytes by actually decoding them (never trusts file names or client MIME types),
 * strips metadata, and stores a full-size PNG/WebP plus a WebP thumbnail.
 */
export async function storeImage(userId: string, input: Buffer, opts: { maxBytes?: number; keepFormat?: boolean } = {}): Promise<StoredImage> {
  if (opts.maxBytes && input.byteLength > opts.maxBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", `Image must be smaller than ${Math.round(opts.maxBytes / 1024 / 1024)} MB`);
  }
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 64_000_000 }).metadata();
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA", "The file is not a valid image");
  }
  if (!meta.format || !ALLOWED_INPUT.has(meta.format)) throw new AppError("UNSUPPORTED_MEDIA", "Only PNG, JPEG and WebP images are supported");
  if (!meta.width || !meta.height) throw new AppError("UNSUPPORTED_MEDIA", "Could not read image dimensions");

  const base = `users/${userId}/${new Date().toISOString().slice(0, 7)}/${randomToken(16)}`;
  // Re-encode (drops EXIF/GPS metadata and any trailing payloads).
  const pipeline = sharp(input).rotate();
  const hasAlpha = Boolean(meta.hasAlpha);
  const full = hasAlpha || meta.format === "png" ? await pipeline.png({ compressionLevel: 8 }).toBuffer({ resolveWithObject: true })
    : await pipeline.webp({ quality: 95 }).toBuffer({ resolveWithObject: true });
  const mimeType = full.info.format === "png" ? "image/png" : "image/webp";
  const ext = full.info.format === "png" ? "png" : "webp";
  const thumb = await sharp(full.data).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

  const storageKey = `${base}.${ext}`;
  const thumbKey = `${base}_thumb.webp`;
  const s = storage();
  await s.put(storageKey, full.data, mimeType);
  await s.put(thumbKey, thumb, "image/webp");
  return { storageKey, thumbKey, mimeType, width: full.info.width, height: full.info.height, bytes: full.data.byteLength };
}

export async function deleteStoredImage(keys: { storageKey: string; thumbKey: string | null }) {
  const s = storage();
  await s.delete(keys.storageKey).catch(() => undefined);
  if (keys.thumbKey) await s.delete(keys.thumbKey).catch(() => undefined);
}
