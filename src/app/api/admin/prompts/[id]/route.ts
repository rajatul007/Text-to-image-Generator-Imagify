import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { promptTemplateSchema } from "@/lib/admin-schemas";

export const PATCH = route({ auth: "admin" }, async ({ user, params, json, ip }) => {
  const data = await json(promptTemplateSchema.partial());
  const exists = await db.promptTemplate.findUnique({ where: { id: params.id } });
  if (!exists) throw notFound("Prompt");
  const t = await db.promptTemplate.update({ where: { id: params.id }, data });
  await audit(user.id, "prompt.update", { type: "PromptTemplate", id: t.id }, { changes: Object.keys(data) }, ip);
  return { template: t };
});

export const DELETE = route({ auth: "admin" }, async ({ user, params, ip }) => {
  const t = await db.promptTemplate.findUnique({ where: { id: params.id } });
  if (!t) throw notFound("Prompt");
  await db.promptTemplate.delete({ where: { id: t.id } });
  await audit(user.id, "prompt.delete", { type: "PromptTemplate", id: t.id }, { title: t.title }, ip);
  return { ok: true };
});
