import { z } from "zod";
import { db } from "./db";

export const settingsSchema = z.object({
  welcomeCredits: z.number().int().min(0).max(10_000),
  lowCreditThreshold: z.number().int().min(0).max(10_000),
  maxActiveJobsPerUser: z.number().int().min(1).max(20),
  reportAutoHideThreshold: z.number().int().min(1).max(100),
  publicUserPromptsEnabled: z.boolean(),
  maxUploadMb: z.number().int().min(1).max(25),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  welcomeCredits: 25,
  lowCreditThreshold: 10,
  maxActiveJobsPerUser: 3,
  reportAutoHideThreshold: 3,
  publicUserPromptsEnabled: true,
  maxUploadMb: 10,
};

const KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...(row.value as object) };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = settingsSchema.parse({ ...current, ...patch });
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } });
  return next;
}
