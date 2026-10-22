import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { imageUrls } from "@/lib/images/access";

/** GDPR-style data export (JSON). Image files are referenced by authenticated download URLs. */
export const GET = route({}, async ({ user }) => {
  const [account, jobs, images, ledger, orders, favorites, enhancements, notifications] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, email: true, name: true, emailVerified: true, createdAt: true, profile: true, wallet: true, accounts: { select: { provider: true, createdAt: true } } } }),
    db.generationJob.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, omit: { lockedBy: true, lockedAt: true } }),
    db.generatedImage.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, omit: { storageKey: true, thumbKey: true } }),
    db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.paymentOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.favorite.findMany({ where: { userId: user.id } }),
    db.promptEnhancement.findMany({ where: { userId: user.id } }),
    db.notification.findMany({ where: { userId: user.id } }),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account,
    generations: jobs,
    images: images.map((i) => ({ ...i, downloadUrl: imageUrls(i.id).downloadUrl })),
    creditLedger: ledger,
    paymentOrders: orders,
    favorites,
    promptEnhancements: enhancements,
    notifications,
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="text-to-image-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
});
