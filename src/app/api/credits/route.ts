import { route } from "@/lib/api";
import { walletSummary } from "@/lib/queries/credits";
import { getSettings } from "@/lib/settings";

export const GET = route({}, async ({ user }) => {
  const [wallet, settings] = await Promise.all([walletSummary(user.id), getSettings()]);
  return { ...wallet, lowCreditThreshold: settings.lowCreditThreshold, low: wallet.balance < settings.lowCreditThreshold };
});
