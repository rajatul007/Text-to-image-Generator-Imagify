import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { announcementSchema } from "@/lib/admin-schemas";

export const PATCH = route({ auth: "admin" }, async ({ user, params, json, ip }) => {
  const data = await json(announcementSchema.partial());
  if (!(await db.announcement.findUnique({ where: { id: params.id } }))) throw notFound("Announcement");
  const a = await db.announcement.update({ where: { id: params.id }, data: { ...data, endsAt: data.endsAt === undefined ? undefined : data.endsAt ? new Date(data.endsAt) : null } });
  await audit(user.id, "announcement.update", { type: "Announcement", id: a.id }, { changes: Object.keys(data) }, ip);
  return { announcement: a };
});

export const DELETE = route({ auth: "admin" }, async ({ user, params, ip }) => {
  if (!(await db.announcement.findUnique({ where: { id: params.id } }))) throw notFound("Announcement");
  await db.announcement.delete({ where: { id: params.id } });
  await audit(user.id, "announcement.delete", { type: "Announcement", id: params.id }, {}, ip);
  return { ok: true };
});
