import { route } from "@/lib/api";
import { db, isUniqueViolation } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { packageSchema } from "@/lib/admin-schemas";

export const GET = route({ auth: "admin" }, async () => ({ packages: await db.creditPackage.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = route({ auth: "admin" }, async ({ user, json, ip }) => {
  const data = await json(packageSchema);
  try {
    const pkg = await db.creditPackage.create({ data });
    await audit(user.id, "package.create", { type: "CreditPackage", id: pkg.id }, data, ip);
    return { package: pkg };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", "A package with this slug already exists");
    throw err;
  }
});
