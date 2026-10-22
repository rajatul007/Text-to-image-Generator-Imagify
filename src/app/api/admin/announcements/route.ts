import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { announcementSchema } from "@/lib/admin-schemas";

export const GET = route({ auth: "admin" }, async () => ({ items: await db.announcement.findMany({ orderBy: { createdAt: "desc" } }) }));

export const POST = route({ auth: "admin" }, async ({ user, json, ip }) => {
  const data = await json(announcementSchema);
  const a = await db.announcement.create({ data: { ...data, endsAt: data.endsAt ? new Date(data.endsAt) : null } });
  await audit(user.id, "announcement.create", { type: "Announcement", id: a.id }, { title: a.title }, ip);
  return { announcement: a };
});
