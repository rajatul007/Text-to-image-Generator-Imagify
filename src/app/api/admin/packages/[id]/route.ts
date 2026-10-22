import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { packageSchema } from "@/lib/admin-schemas";

/** Packages are never deleted (orders reference them); disable them instead. Existing orders keep their own price snapshot. */
export const PATCH = route({ auth: "admin" }, async ({ user, params, json, ip }) => {
  const data = await json(packageSchema.partial());
  const before = await db.creditPackage.findUnique({ where: { id: params.id } });
  if (!before) throw notFound("Package");
  const pkg = await db.creditPackage.update({ where: { id: params.id }, data });
  await audit(user.id, "package.update", { type: "CreditPackage", id: pkg.id }, { before: { credits: before.credits, pricePaise: before.pricePaise, active: before.active }, after: data }, ip);
  return { package: pkg };
});
