import { route } from "@/lib/api";
import { cancelJob } from "@/lib/jobs/create";
import { serializeJob } from "@/lib/queries/jobs";
import { getBalance } from "@/lib/credits/ledger";

export const POST = route({}, async ({ user, params }) => {
  const job = await cancelJob(user.id, params.id);
  return { job: serializeJob(job), balance: await getBalance(user.id) };
});
