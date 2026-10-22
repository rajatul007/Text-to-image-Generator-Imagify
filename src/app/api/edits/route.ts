import { route } from "@/lib/api";
import { RULES } from "@/lib/rate-limit";
import { createEditJob, editInputSchema } from "@/lib/jobs/create";
import { serializeJob } from "@/lib/queries/jobs";
import { getBalance } from "@/lib/credits/ledger";

export const POST = route({ verified: true, rateLimit: RULES.generate }, async ({ user, json }) => {
  const input = await json(editInputSchema);
  const { job, duplicate } = await createEditJob(user.id, input);
  return { job: serializeJob(job), duplicate, balance: await getBalance(user.id) };
});

// Generation work continues after the response (after()); allow time for slow providers on serverless hosts.
export const maxDuration = 300;
