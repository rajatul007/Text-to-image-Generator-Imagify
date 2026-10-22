import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as createGen, GET as listGen } from "@/app/api/generations/route";
import { GET as getGen } from "@/app/api/generations/[id]/route";
import { POST as cancelGen } from "@/app/api/generations/[id]/cancel/route";
import { POST as retryGen } from "@/app/api/generations/[id]/retry/route";
import { processJob, failJob } from "@/lib/jobs/processor";
import { resetEnvCache } from "@/lib/env";
import { balanceOf, call, installFetch, makeUser, pngBuffer, resetDb } from "./helpers";

const base = { modelId: "stability-core", prompt: "A lighthouse in a storm", aspectRatio: "16:9", numImages: 2, quality: "standard" };

function stabilityRoute(behaviour: "ok" | "fail" | "filtered" = "ok") {
  return {
    "http://stability.test": async (_url: string, init: RequestInit) => {
      if (behaviour === "fail") return new Response('{"errors":["boom"]}', { status: 500 });
      if (behaviour === "filtered") return new Response(new Uint8Array(await pngBuffer()), { headers: { "finish-reason": "CONTENT_FILTERED" } });
      const form = init.body as FormData;
      const seed = form.get("seed");
      return new Response(new Uint8Array(await pngBuffer(96, 54)), { headers: { "content-type": "image/png", "finish-reason": "SUCCESS", ...(seed ? { seed: String(seed) } : {}) } });
    },
  };
}

describe("generation jobs", () => {
  beforeEach(resetDb);

  it("charges the server-calculated cost and ignores any client-supplied cost", async () => {
    const { session, user } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, idempotencyKey: "key-aaaaaaaa", creditsCharged: 0, cost: 0 } });
    expect(res.status).toBe(200);
    expect(res.json.job.creditsCharged).toBe(6); // 3 credits × 2 images
    expect(await balanceOf(user.id)).toBe(14);
    const charge = await db.creditTransaction.findFirstOrThrow({ where: { userId: user.id, type: "GENERATION_CHARGE" } });
    expect(charge.amount).toBe(-6);
    expect(charge.jobId).toBe(res.json.job.id);
  });

  it("rejects the request with 402 when credits are insufficient and creates no job", async () => {
    const { session, user } = await makeUser({ credits: 5 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, idempotencyKey: "key-bbbbbbbb" } });
    expect(res.status).toBe(402);
    expect(res.json.error.code).toBe("INSUFFICIENT_CREDITS");
    expect(await db.generationJob.count({ where: { userId: user.id } })).toBe(0);
    expect(await balanceOf(user.id)).toBe(5);
  });

  it("requires a verified email", async () => {
    const { session } = await makeUser({ credits: 20, verified: false });
    expect((await call(createGen, "/api/generations", { session, body: { ...base, idempotencyKey: "key-cccccccc" } })).status).toBe(403);
  });

  it("is idempotent: duplicate and concurrent submissions create one job and one charge", async () => {
    const { session, user } = await makeUser({ credits: 50 });
    const body = { ...base, idempotencyKey: "same-key-12345" };
    const results = await Promise.all([1, 2, 3, 4].map(() => call(createGen, "/api/generations", { session, body })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.json.job.id)).size).toBe(1);
    expect(await db.generationJob.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: "GENERATION_CHARGE" } })).toBe(1);
    expect(await balanceOf(user.id)).toBe(44);
  });

  it("concurrent different requests can never overdraw the wallet", async () => {
    const { session, user } = await makeUser({ credits: 7 });
    const results = await Promise.all([1, 2, 3, 4].map((i) => call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, idempotencyKey: `parallel-key-${i}` } })));
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(2); // 2 × 3 credits fit into 7
    expect(await balanceOf(user.id)).toBe(1);
  });

  it("processes a job end-to-end, persists seeds per image, model version and history", async () => {
    installFetch(stabilityRoute("ok"));
    const { session, user } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, seed: 1234, negativePrompt: "blurry", style: "cinematic", idempotencyKey: "key-dddddddd" } });
    const id = res.json.job.id;
    expect(res.json.job.status).toBe("QUEUED");
    await processJob(id, "test");
    const status = await call(getGen, `/api/generations/${id}`, { session, params: { id } });
    expect(status.json.job.status).toBe("COMPLETED");
    expect(status.json.job.seed).toBe(1234);
    expect(status.json.job.images.map((i: { seed: number }) => i.seed)).toEqual([1234, 1235]);
    expect(status.json.job.modelVersion).toBe("stable-image-core (v2beta)");
    const job = await db.generationJob.findUniqueOrThrow({ where: { id } });
    expect(job.finalPrompt).toContain("cinematic film still");
    expect(job.negativePrompt).toContain("blurry");
    const images = await db.generatedImage.findMany({ where: { jobId: id } });
    expect(images).toHaveLength(2);
    expect(images.every((i) => i.visibility === "PRIVATE" && i.storageKey.startsWith(`users/${user.id}/`))).toBe(true);
    const history = await call(listGen, "/api/generations", { session, query: { q: "lighthouse" } });
    expect(history.json.total).toBe(1);
  });

  it("chooses and stores a random seed when none is given on seed-capable models", async () => {
    const { session } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, idempotencyKey: "key-eeeeeeee" } });
    expect(typeof res.json.job.seed).toBe("number");
  });

  it("rejects seeds and unsupported ratios on models that don't support them", async () => {
    process.env.OPENAI_API_KEY = "test-openai";
    resetEnvCache();
    try {
      const { session } = await makeUser({ credits: 50 });
      const seed = await call(createGen, "/api/generations", { session, body: { ...base, modelId: "gpt-image-1", aspectRatio: "1:1", numImages: 1, seed: 7, idempotencyKey: "key-ffffffff" } });
      expect(seed.status).toBe(422);
      const ratio = await call(createGen, "/api/generations", { session, body: { ...base, modelId: "gpt-image-1", aspectRatio: "21:9", numImages: 1, idempotencyKey: "key-gggggggg" } });
      expect(ratio.status).toBe(422);
    } finally {
      process.env.OPENAI_API_KEY = "";
      resetEnvCache();
    }
  });

  it("reports unavailable providers clearly without charging", async () => {
    const { session, user } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, modelId: "flux-schnell", idempotencyKey: "key-hhhhhhhh" } });
    expect(res.status).toBe(503);
    expect(await balanceOf(user.id)).toBe(20);
  });

  it("retries transient provider failures, then fails and refunds exactly once", async () => {
    const calls = installFetch(stabilityRoute("fail"));
    const { session, user } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, idempotencyKey: "key-iiiiiiii" } });
    const id = res.json.job.id;
    expect(await balanceOf(user.id)).toBe(17);
    for (let attempt = 0; attempt < 3; attempt++) {
      await db.generationJob.update({ where: { id }, data: { nextRunAt: new Date(0) } }).catch(() => undefined);
      await processJob(id, "test");
    }
    expect(calls.length).toBe(3);
    const job = await db.generationJob.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("FAILED");
    expect(job.attempts).toBe(3);
    expect(job.prompt).toBe(base.prompt); // prompt preserved for retry
    expect(await balanceOf(user.id)).toBe(20);
    // a second failure signal must not refund again
    await failJob(job, "x", "again");
    expect(await db.creditTransaction.count({ where: { jobId: id, type: "REFUND" } })).toBe(1);
    expect(await balanceOf(user.id)).toBe(20);
    const notification = await db.notification.findFirst({ where: { userId: user.id, type: "GENERATION_FAILED" } });
    expect(notification).not.toBeNull();
  });

  it("does not retry content-filter rejections", async () => {
    const calls = installFetch(stabilityRoute("filtered"));
    const { session, user } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, idempotencyKey: "key-jjjjjjjj" } });
    await processJob(res.json.job.id, "test");
    const job = await db.generationJob.findUniqueOrThrow({ where: { id: res.json.job.id } });
    expect(job.status).toBe("FAILED");
    expect(job.errorCode).toBe("content_filtered");
    expect(calls).toHaveLength(1);
    expect(await balanceOf(user.id)).toBe(20);
  });

  it("cancels queued jobs with a refund, but not jobs that already started", async () => {
    const { session, user } = await makeUser({ credits: 20 });
    const a = await call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, idempotencyKey: "key-kkkkkkkk" } });
    const cancel = await call(cancelGen, `/x`, { session, params: { id: a.json.job.id }, method: "POST" });
    expect(cancel.json.job.status).toBe("CANCELLED");
    expect(await balanceOf(user.id)).toBe(20);
    const again = await call(cancelGen, `/x`, { session, params: { id: a.json.job.id }, method: "POST" });
    expect(again.status).toBe(409);
    expect(await db.creditTransaction.count({ where: { jobId: a.json.job.id, type: "REFUND" } })).toBe(1);

    const b = await call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, idempotencyKey: "key-llllllll" } });
    await db.generationJob.update({ where: { id: b.json.job.id }, data: { status: "PROCESSING" } });
    expect((await call(cancelGen, `/x`, { session, params: { id: b.json.job.id }, method: "POST" })).status).toBe(409);
  });

  it("regenerates a finished job with the same seed and settings", async () => {
    installFetch(stabilityRoute("ok"));
    const { session } = await makeUser({ credits: 30 });
    const a = await call(createGen, "/api/generations", { session, body: { ...base, numImages: 1, seed: 99, idempotencyKey: "key-mmmmmmmm" } });
    await processJob(a.json.job.id, "test");
    const r = await call(retryGen, "/x", { session, params: { id: a.json.job.id }, body: { idempotencyKey: "retry-key-0001" } });
    expect(r.status).toBe(200);
    expect(r.json.job.seed).toBe(99);
    expect(r.json.job.prompt).toBe(base.prompt);
    expect(r.json.job.aspectRatio).toBe("16:9");
  });

  it("never exposes another user's job", async () => {
    const owner = await makeUser({ credits: 20 });
    const other = await makeUser();
    const a = await call(createGen, "/api/generations", { session: owner.session, body: { ...base, numImages: 1, idempotencyKey: "key-nnnnnnnn" } });
    expect((await call(getGen, "/x", { session: other.session, params: { id: a.json.job.id } })).status).toBe(404);
    expect((await call(cancelGen, "/x", { session: other.session, params: { id: a.json.job.id }, method: "POST" })).status).toBe(404);
  });

  it("blocks prompts that violate the content policy", async () => {
    const { session, user } = await makeUser({ credits: 20 });
    const res = await call(createGen, "/api/generations", { session, body: { ...base, prompt: "explicit nude photo of a child", idempotencyKey: "key-oooooooo" } });
    expect(res.status).toBe(400);
    expect(await balanceOf(user.id)).toBe(20);
  });
});
