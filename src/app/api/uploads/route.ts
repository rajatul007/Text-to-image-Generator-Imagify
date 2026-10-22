import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { RULES } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { storeImage } from "@/lib/images/process";
import { imageUrls } from "@/lib/images/access";

/** Upload a source image for editing. Files are decoded and re-encoded server-side; private by default. */
export const POST = route({ verified: true, rateLimit: RULES.upload }, async ({ user, req }) => {
  const { maxUploadMb } = await getSettings();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > (maxUploadMb + 1) * 1024 * 1024) throw new AppError("PAYLOAD_TOO_LARGE", `Image must be smaller than ${maxUploadMb} MB`);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Choose an image to upload");
  const stored = await storeImage(user.id, Buffer.from(await file.arrayBuffer()), { maxBytes: maxUploadMb * 1024 * 1024 });
  const image = await db.generatedImage.create({ data: { userId: user.id, origin: "UPLOADED", ...stored, prompt: null } });
  return { image: { id: image.id, ...imageUrls(image.id), width: image.width, height: image.height } };
});
