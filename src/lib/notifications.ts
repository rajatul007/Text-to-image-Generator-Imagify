import type { Profile } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { sendEmail } from "./email";
import { templates } from "./email/templates";
import { getSettings } from "./settings";

type EmailPref = keyof Pick<Profile, "emailGenerationComplete" | "emailGenerationFailed" | "emailLowCredits" | "emailPayments">;

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  email?: { pref: EmailPref | "always"; build: (name: string, appUrl: string) => import("./email/templates").EmailContent; template: string };
}

/** Creates an in-app notification and (optionally) an email, honouring the user's preferences. Never throws. */
export async function notify(input: NotifyInput) {
  try {
    const user = await db.user.findUnique({ where: { id: input.userId }, include: { profile: true } });
    if (!user || user.status === "DELETED") return;
    const profile = user.profile;
    if (profile?.inAppNotifications !== false) {
      await db.notification.create({ data: { userId: user.id, type: input.type, title: input.title, body: input.body, link: input.link } });
    }
    if (input.email) {
      const allowed = input.email.pref === "always" || (profile ? profile[input.email.pref] : true);
      if (allowed) await sendEmail(user.email, input.email.template, input.email.build(user.name, env().APP_URL));
    }
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "notify failed", error: (err as Error).message }));
  }
}

/** Sends a single low-credit alert when a balance crosses below the configured threshold. */
export async function maybeNotifyLowCredits(userId: string, previousBalance: number, newBalance: number) {
  const { lowCreditThreshold } = await getSettings();
  if (previousBalance >= lowCreditThreshold && newBalance < lowCreditThreshold) {
    await notify({
      userId,
      type: "LOW_CREDITS",
      title: "Low credit balance",
      body: `You have ${newBalance} credit${newBalance === 1 ? "" : "s"} left.`,
      link: "/credits",
      email: { pref: "emailLowCredits", template: "lowCredits", build: (name, url) => templates.lowCredits(name, newBalance, `${url}/credits`) },
    });
  }
}
