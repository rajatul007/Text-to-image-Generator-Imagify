import { route } from "@/lib/api";
import { db } from "@/lib/db";

/** Counts template usage (powers "Trending"). */
export const POST = route({ auth: "optional" }, async ({ params }) => {
  await db.promptTemplate.updateMany({ where: { id: params.id, status: "PUBLISHED" }, data: { usageCount: { increment: 1 } } });
  return { ok: true };
});
