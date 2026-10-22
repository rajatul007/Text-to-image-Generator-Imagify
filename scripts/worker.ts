/**
 * Background generation worker. Run alongside the web server when JOB_RUNNER=worker:
 *   npm run worker
 * Multiple workers can run in parallel – jobs are claimed with an atomic conditional update.
 */
import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import { db } from "../src/lib/db";
import { processJob, recoverStaleJobs } from "../src/lib/jobs/processor";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 1000);
const workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
let stopping = false;
const inFlight = new Set<string>();

async function tick() {
  const free = CONCURRENCY - inFlight.size;
  if (free <= 0) return;
  const candidates = await db.generationJob.findMany({
    where: { status: "QUEUED", nextRunAt: { lte: new Date() }, id: { notIn: [...inFlight] } },
    orderBy: { createdAt: "asc" },
    take: free,
    select: { id: true },
  });
  for (const { id } of candidates) {
    inFlight.add(id);
    processJob(id, workerId)
      .catch((err) => console.error(JSON.stringify({ level: "error", msg: "job crashed", jobId: id, error: (err as Error).message })))
      .finally(() => inFlight.delete(id));
  }
}

async function main() {
  console.log(JSON.stringify({ level: "info", msg: "worker started", workerId, concurrency: CONCURRENCY }));
  let lastRecovery = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastRecovery > 30_000) {
        const n = await recoverStaleJobs();
        if (n) console.log(JSON.stringify({ level: "warn", msg: "recovered stale jobs", count: n }));
        lastRecovery = Date.now();
      }
      await tick();
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "worker tick failed", error: (err as Error).message }));
    }
    await sleep(POLL_MS);
  }
  while (inFlight.size > 0) await sleep(250);
  await db.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(JSON.stringify({ level: "info", msg: `received ${sig}, draining` }));
    stopping = true;
  });
}

main();
