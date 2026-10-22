import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { resolveShareToken } from "@/lib/images/manage";
import { storage } from "@/lib/storage";

/** Serves a shared image. The token is validated on every request, so revoking takes effect immediately. */
export const GET = route({ auth: "none" }, async ({ params, req }) => {
  const link = await resolveShareToken(params.token);
  if (!link) return new NextResponse("This link is no longer available", { status: 404 });
  const img = link.image;
  const thumb = req.nextUrl.searchParams.get("variant") === "thumb" && img.thumbKey;
  const download = req.nextUrl.searchParams.get("download") === "1";
  return storage().serve(thumb ? img.thumbKey! : img.storageKey, thumb ? "image/webp" : img.mimeType, {
    download: download ? `text-to-image-${img.id}.${img.mimeType === "image/png" ? "png" : "webp"}` : undefined,
    cacheSeconds: 0,
  });
});
