import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getSettings, settingsSchema, updateSettings } from "@/lib/settings";
import { integrationStatus } from "@/lib/env";

export const GET = route({ auth: "admin" }, async () => ({ settings: await getSettings(), integrations: integrationStatus() }));

export const PATCH = route({ auth: "admin" }, async ({ user, json, ip }) => {
  const patch = await json(settingsSchema.partial());
  const before = await getSettings();
  const settings = await updateSettings(patch);
  await audit(user.id, "settings.update", { type: "AppSetting", id: "app" }, { before, after: settings }, ip);
  return { settings };
});
