import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as createGen } from "@/app/api/generations/route";
import { POST as createEdit } from "@/app/api/edits/route";
import { GET as imageDetail } from "@/app/api/images/[id]/route";
import { PATCH as suspend } from "@/app/api/admin/users/[id]/route";
import { PATCH as moderate } from "@/app/api/admin/reports/[id]/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { GET as exportData } from "@/app/api/account/export/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as explore } from "@/app/api/explore/route";
import { processJob, recoverStaleJobs } from "@/lib/jobs/processor";
import { storeImage } from "@/lib/images/process";
import { balanceOf, call, installFetch, makeUser, pngBuffer, resetDb } from "./helpers";

describe("job progress, editing lineage, moderation and account lifecycle", () => {
  beforeEach(resetDb);

  it("moves through real stages QUEUED → PROCESSING → UPLOADING → COMPLETED", async () => {
    const seen: string[] = [];
    let jobId = "";
    installFetch({
      "http://stability.test": async () => {
        seen.push((await db.generationJob.findUniqueOrThrow({ where: { id: jobId } })).status);
        return new Response(new Uint8Array(await pngBuffer()), { headers: { "finish-reason": "SUCCESS", seed: "5" } });
      },
    });
    const { session } = await makeUser({ credits: 10 });
    const res = await call(createGen, "/api/generations", { session, body: { modelId: "stability-core", prompt: "a red fox in snow", aspectRatio: "1:1", numImages: 1, idempotencyKey: "progress-0001" } });
    jobId = res.json.job.id;
    seen.push(res.json.job.status);
    await processJob(jobId, "t");
    const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(seen).toEqual(["QUEUED", "PROCESSING"]);
    expect(job.status).toBe("COMPLETED");
    expect(job.startedAt).not.toBeNull();
    expect(job.completedAt).not.toBeNull();
    // processing the same job again is a no-op (atomic claim)
    await processJob(jobId, "t2");
    expect(await db.generatedImage.count({ where: { jobId } })).toBe(1);
  });

  it("recovers jobs abandoned by a crashed worker, failing and refunding when out of attempts", async () => {
    const { session, user } = await makeUser({ credits: 10 });
    const res = await call(createGen, "/api/generations", { session, body: { modelId: "stability-core", prompt: "a red fox in snow", aspectRatio: "1:1", numImages: 1, idempotencyKey: "stale-0001" } });
    await db.generationJob.update({ where: { id: res.json.job.id }, data: { status: "PROCESSING", lockedAt: new Date(Date.now() - 3_600_000), attempts: 3 } });
    expect(await recoverStaleJobs()).toBe(1);
    expect((await db.generationJob.findUniqueOrThrow({ where: { id: res.json.job.id } })).status).toBe("FAILED");
    expect(await balanceOf(user.id)).toBe(10);
  });

  it("edits create a new version linked to the original, which is never overwritten", async () => {
    installFetch({ "http://stability.test": async () => new Response(new Uint8Array(await pngBuffer(128, 96)), { headers: { "finish-reason": "SUCCESS", seed: "11" } }) });
    const { session, user } = await makeUser({ credits: 20 });
    const stored = await storeImage(user.id, await pngBuffer(64, 48));
    const original = await db.generatedImage.create({ data: { userId: user.id, origin: "UPLOADED", ...stored } });
    const edit = await call(createEdit, "/api/edits", { session, body: { sourceImageId: original.id, type: "EDIT", modelId: "stability-img2img", prompt: "make it snowy", idempotencyKey: "edit-0000001" } });
    expect(edit.status).toBe(200);
    await processJob(edit.json.job.id, "t");
    const up = await call(createEdit, "/api/edits", { session, body: { sourceImageId: original.id, type: "UPSCALE", modelId: "stability-upscale", idempotencyKey: "edit-0000002" } });
    await processJob(up.json.job.id, "t");
    const detail = await call(imageDetail, "/x", { session, params: { id: original.id } });
    expect(detail.json.versions.map((v: { versionNumber: number; operation: string; instruction: string | null }) => [v.versionNumber, v.operation, v.instruction])).toEqual([
      [1, "EDIT", "make it snowy"],
      [2, "UPSCALE", null],
    ]);
    const edited = await db.generatedImage.findFirstOrThrow({ where: { jobId: edit.json.job.id } });
    expect(edited.parentId).toBe(original.id);
    expect(edited.origin).toBe("EDITED");
    expect((await db.generatedImage.findUniqueOrThrow({ where: { id: original.id } })).storageKey).toBe(stored.storageKey);
    // another user can't edit my image
    const other = await makeUser({ credits: 20 });
    expect((await call(createEdit, "/api/edits", { session: other.session, body: { sourceImageId: original.id, type: "UPSCALE", modelId: "stability-upscale", idempotencyKey: "edit-0000003" } })).status).toBe(404);
  });

  it("admins can suspend users (sessions revoked, action audited) and remove reported images", async () => {
    const admin = await makeUser({ admin: true });
    const target = await makeUser();
    const noReason = await call(suspend, "/x", { session: admin.session, params: { id: target.user.id }, method: "PATCH", body: { action: "suspend", reason: "" } });
    expect(noReason.status).toBe(422);
    await call(suspend, "/x", { session: admin.session, params: { id: target.user.id }, method: "PATCH", body: { action: "suspend", reason: "Spamming the gallery" } });
    expect((await call(me, "/x", { session: target.session })).json.user).toBeNull();
    expect(await db.adminAuditLog.count({ where: { action: "user.suspend" } })).toBe(1);

    const creator = await makeUser();
    const stored = await storeImage(creator.user.id, await pngBuffer());
    const img = await db.generatedImage.create({ data: { userId: creator.user.id, ...stored, visibility: "PUBLIC", publishedAt: new Date() } });
    const report = await db.contentReport.create({ data: { imageId: img.id, reporterId: admin.user.id, reason: "VIOLENCE" } });
    expect((await call(moderate, "/x", { session: creator.session, params: { id: report.id }, method: "PATCH", body: { action: "remove" } })).status).toBe(403);
    await call(moderate, "/x", { session: admin.session, params: { id: report.id }, method: "PATCH", body: { action: "remove" } });
    const after = await db.generatedImage.findUniqueOrThrow({ where: { id: img.id } });
    expect(after.moderationStatus).toBe("REMOVED");
    expect(after.visibility).toBe("PRIVATE");
    expect((await call(explore, "/api/explore", { query: { sort: "recent" } })).json.items).toHaveLength(0);
  });

  it("exports user data and deletes the account while keeping the anonymised ledger", async () => {
    const { session, user } = await makeUser({ credits: 15 });
    const exp = await call(exportData, "/api/account/export", { session });
    expect(exp.status).toBe(200);
    expect(exp.json.account.email).toBe(user.email);
    expect(exp.json.creditLedger).toHaveLength(1);
    expect(JSON.stringify(exp.json)).not.toContain("passwordHash");
    const wrong = await call(deleteAccount, "/api/account", { session, method: "DELETE", body: { password: "nope12345", confirm: "DELETE" } });
    expect(wrong.status).toBe(422);
    const ok = await call(deleteAccount, "/api/account", { session, method: "DELETE", body: { password: "password123", confirm: "DELETE" } });
    expect(ok.status).toBe(200);
    const deleted = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(deleted.status).toBe("DELETED");
    expect(deleted.email).not.toBe(user.email);
    expect(deleted.passwordHash).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(1);
  });
});
