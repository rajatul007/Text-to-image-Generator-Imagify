import { z } from "zod";
import { route } from "@/lib/api";
import { db, isUniqueViolation } from "@/lib/db";
import { AppError } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  displayName: z.string().trim().min(2).max(60).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Username must be 3–24 characters: letters, numbers or underscores")
    .optional(),
  bio: z.string().trim().max(280).optional().nullable(),
  emailGenerationComplete: z.boolean().optional(),
  emailGenerationFailed: z.boolean().optional(),
  emailLowCredits: z.boolean().optional(),
  emailPayments: z.boolean().optional(),
  emailProductUpdates: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
  defaultShowPrompt: z.boolean().optional(),
  defaultShowCreator: z.boolean().optional(),
});

export const GET = route({}, async ({ user }) => {
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  return { user: { id: user.id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerified), hasPassword: user.hasPassword }, profile };
});

export const PATCH = route({}, async ({ user, json }) => {
  const { name, ...profileData } = await json(patchSchema);
  try {
    const [, profile] = await db.$transaction([
      db.user.update({ where: { id: user.id }, data: name ? { name } : {} }),
      db.profile.update({ where: { userId: user.id }, data: profileData }),
    ]);
    return { profile };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", "That username is already taken");
    throw err;
  }
});
