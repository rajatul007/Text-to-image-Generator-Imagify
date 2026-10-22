import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { modelPatchSchema } from "@/lib/admin-schemas";

export const PATCH = route({ auth: "admin" }, async ({ user, params, json, ip }) => {
  const data = await json(modelPatchSchema);
  const before = await db.aiModel.findUnique({ where: { id: params.id } });
  if (!before) throw notFound("Model");
  const model = await db.aiModel.update({ where: { id: params.id }, data });
  await audit(user.id, "model.update", { type: "AiModel", id: model.id }, { before: { enabled: before.enabled, creditsPerImage: before.creditsPerImage }, after: data }, ip);
  return { model: { ...model, estimatedCostUsd: Number(model.estimatedCostUsd) } };
});
