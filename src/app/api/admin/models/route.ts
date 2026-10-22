import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { toPublicModel } from "@/lib/ai/registry";

export const GET = route({ auth: "admin" }, async () => {
  const models = await db.aiModel.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  return { models: models.map((m) => ({ ...toPublicModel(m), enabled: m.enabled, estimatedCostUsd: Number(m.estimatedCostUsd), sortOrder: m.sortOrder })) };
});
