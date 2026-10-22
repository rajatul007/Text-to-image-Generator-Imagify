import { after } from "next/server";
import { logger } from "../logger";

/**
 * Dispatches a job for processing.
 * - JOB_RUNNER=inline (default): processed in this Node.js server after the response is sent.
 *   Retries are scheduled in-process. Suitable for a single long-running `next start` instance.
 * - JOB_RUNNER=worker: nothing happens here; `npm run worker` polls the queue (recommended for production/serverless).
 */
export function dispatchJob(jobId: string) {
  if ((process.env.JOB_RUNNER ?? "inline") !== "inline") return;
  const run = async () => {
    const { processJob } = await import("./processor");
    await processJob(jobId, `inline-${process.pid}`, (id, delay) => {
      setTimeout(() => dispatchDetached(id), delay + 50).unref?.();
    });
  };
  try {
    after(() => run().catch((err) => logger.error("inline job failed", { jobId, error: (err as Error).message })));
  } catch {
    // Not inside a request scope (e.g. scripts/tests) – run detached.
    dispatchDetached(jobId);
  }
}

function dispatchDetached(jobId: string) {
  void import("./processor").then(({ processJob }) =>
    processJob(jobId, `inline-${process.pid}`, (id, delay) => {
      setTimeout(() => dispatchDetached(id), delay + 50).unref?.();
    }).catch((err) => logger.error("inline job failed", { jobId, error: (err as Error).message })),
  );
}
