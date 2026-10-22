import { route } from "@/lib/api";
import { RULES } from "@/lib/rate-limit";
import { createGenerationJob, generateInputSchema } from "@/lib/jobs/create";
import { historyQuerySchema, listJobs, serializeJob } from "@/lib/queries/jobs";
import { getBalance } from "@/lib/credits/ledger";

export const GET = route({}, async ({ user, query }) => listJobs(user.id, query(historyQuerySchema)));

export const POST = route({ verified: true, rateLimit: RULES.generate }, async ({ user, json }) => {
  const input = await json(generateInputSchema);
  const { job, duplicate } = await createGenerationJob(user.id, input);
  return { job: serializeJob(job), duplicate, balance: await getBalance(user.id) };
});
