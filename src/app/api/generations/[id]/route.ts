import { after } from "next/server";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { serializeJob } from "@/lib/queries/jobs";
import { dispatchJob } from "@/lib/jobs/runner";
import { recoverStaleJobs } from "@/lib/jobs/processor";

export const GET = route({}, async ({ user, params }) => {
  const job = await db.generationJob.findFirst({
    where: { id: params.id, userId: user.id },
    include: { images: { orderBy: { createdAt: "asc" } }, model: { select: { displayName: true } } },
  });
  if (!job) throw notFound("Generation");
  // Self-healing for the inline runner: re-dispatch a due job that isn't being processed (e.g. after a restart).
  if (process.env.JOB_RUNNER !== "worker") {
    if (job.status === "QUEUED" && job.nextRunAt.getTime() < Date.now() - 3000) dispatchJob(job.id);
    if ((job.status === "PROCESSING" || job.status === "UPLOADING") && job.lockedAt && Date.now() - job.lockedAt.getTime() > 5 * 60_000) {
      after(() => recoverStaleJobs().then(() => undefined));
    }
  }
  return { job: serializeJob(job) };
});
