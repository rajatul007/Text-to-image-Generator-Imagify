import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Avatars are public profile pictures.
export const GET = route({ auth: "none" }, async ({ params }) => {
  const profile = await db.profile.findUnique({ where: { userId: params.userId }, select: { avatarKey: true, user: { select: { status: true } } } });
  if (!profile?.avatarKey || profile.user.status === "DELETED") return new NextResponse(null, { status: 404 });
  return storage().serve(profile.avatarKey, "image/webp", { cacheSeconds: 3600 });
});
