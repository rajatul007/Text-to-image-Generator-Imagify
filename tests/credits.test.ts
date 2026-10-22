import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { applyCreditChange } from "@/lib/credits/ledger";
import { generationCost } from "@/lib/credits/pricing";
import { GET as ledger } from "@/app/api/credits/ledger/route";
import { POST as adjust } from "@/app/api/admin/users/[id]/credits/route";
import { balanceOf, call, makeUser, resetDb } from "./helpers";

describe("credit wallet & ledger", () => {
  beforeEach(resetDb);

  it("computes costs from model, image count and quality", () => {
    const model = { creditsPerImage: 5, hdMultiplier: 3, qualities: ["standard", "hd"], maxImages: 4 };
    expect(generationCost({ model, numImages: 2, quality: "standard" })).toBe(10);
    expect(generationCost({ model, numImages: 2, quality: "hd" })).toBe(30);
    expect(() => generationCost({ model, numImages: 5, quality: "standard" })).toThrow();
  });

  it("applies each idempotency key once, even concurrently", async () => {
    const { user } = await makeUser();
    const results = await Promise.all(Array.from({ length: 5 }, () => applyCreditChange({ userId: user.id, amount: 10, type: "PROMOTIONAL", idempotencyKey: "promo:launch", description: "Launch promo" })));
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(await balanceOf(user.id)).toBe(10);
  });

  it("never lets the balance go below zero", async () => {
    const { user } = await makeUser({ credits: 5 });
    await expect(applyCreditChange({ userId: user.id, amount: -6, type: "GENERATION_CHARGE", idempotencyKey: "c1", description: "x" })).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    await expect(db.$executeRaw`UPDATE "CreditWallet" SET balance = -1 WHERE "userId" = ${user.id}`).rejects.toThrow();
    expect(await balanceOf(user.id)).toBe(5);
  });

  it("the ledger is immutable", async () => {
    const { user } = await makeUser({ credits: 5 });
    const tx = await db.creditTransaction.findFirstOrThrow({ where: { userId: user.id } });
    await expect(db.creditTransaction.update({ where: { id: tx.id }, data: { amount: 500 } })).rejects.toThrow();
    await expect(db.creditTransaction.delete({ where: { id: tx.id } })).rejects.toThrow();
  });

  it("ledger entries record balanceAfter and the wallet matches the sum of the ledger", async () => {
    const { user } = await makeUser({ credits: 30 });
    await applyCreditChange({ userId: user.id, amount: -7, type: "GENERATION_CHARGE", idempotencyKey: "c-a", description: "a" });
    await applyCreditChange({ userId: user.id, amount: 7, type: "REFUND", idempotencyKey: "r-a", description: "a" });
    await applyCreditChange({ userId: user.id, amount: -4, type: "GENERATION_CHARGE", idempotencyKey: "c-b", description: "b" });
    const rows = await db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.balanceAfter)).toEqual([30, 23, 30, 26]);
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    expect(await balanceOf(user.id)).toBe(sum);
    const wallet = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.lifetimeSpent).toBe(11);
    expect(wallet.lifetimeRefunded).toBe(7);
  });

  it("transaction history is filterable and private to its owner", async () => {
    const a = await makeUser({ credits: 30 });
    const b = await makeUser({ credits: 10 });
    await applyCreditChange({ userId: a.user.id, amount: -3, type: "GENERATION_CHARGE", idempotencyKey: "a-1", description: "Generation" });
    const all = await call(ledger, "/api/credits/ledger", { session: a.session });
    expect(all.json.total).toBe(2);
    const charges = await call(ledger, "/api/credits/ledger", { session: a.session, query: { type: "GENERATION_CHARGE" } });
    expect(charges.json.items).toHaveLength(1);
    expect(charges.json.items[0].typeLabel).toBe("Image generation");
    const outOnly = await call(ledger, "/api/credits/ledger", { session: a.session, query: { direction: "in" } });
    expect(outOnly.json.items.every((t: { amount: number }) => t.amount > 0)).toBe(true);
    expect((await call(ledger, "/api/credits/ledger", { session: b.session })).json.total).toBe(1);
  });

  it("admin adjustments require a reason, are idempotent and audited", async () => {
    const admin = await makeUser({ admin: true });
    const target = await makeUser({ credits: 10 });
    const noReason = await call(adjust, "/x", { session: admin.session, params: { id: target.user.id }, body: { amount: 50, kind: "PROMOTIONAL", reason: "", idempotencyKey: "adm-0000001" } });
    expect(noReason.status).toBe(422);
    const negPromo = await call(adjust, "/x", { session: admin.session, params: { id: target.user.id }, body: { amount: -5, kind: "PROMOTIONAL", reason: "oops wrong", idempotencyKey: "adm-0000002" } });
    expect(negPromo.status).toBe(422);
    const body = { amount: 50, kind: "PROMOTIONAL", reason: "Contest winner", idempotencyKey: "adm-0000003" };
    await call(adjust, "/x", { session: admin.session, params: { id: target.user.id }, body });
    await call(adjust, "/x", { session: admin.session, params: { id: target.user.id }, body });
    expect(await balanceOf(target.user.id)).toBe(60);
    expect(await db.adminAuditLog.count({ where: { action: "credits.adjust", targetId: target.user.id } })).toBe(1);
    const tx = await db.creditTransaction.findFirstOrThrow({ where: { userId: target.user.id, type: "PROMOTIONAL", adminId: admin.user.id } });
    expect(tx.reason).toBe("Contest winner");
    // regular users cannot use the endpoint
    expect((await call(adjust, "/x", { session: target.session, params: { id: target.user.id }, body: { ...body, idempotencyKey: "adm-0000004" } })).status).toBe(403);
  });
});
