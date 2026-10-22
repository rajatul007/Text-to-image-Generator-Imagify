import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { planPatchSchema } from "@/lib/admin-schemas";

export const PATCH = route({ auth: "admin" }, async ({ user, params, json, ip }) => {
  const data = await json(planPatchSchema);
  const exists = await db.subscriptionPlan.findUnique({ where: { id: params.id } });
  if (!exists) throw notFound("Plan");
  const plan = await db.subscriptionPlan.update({ where: { id: params.id }, data });
  await audit(user.id, "plan.update", { type: "SubscriptionPlan", id: plan.id }, data, ip);
  return { plan };
});
