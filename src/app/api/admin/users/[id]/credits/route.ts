import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { applyCreditChange } from "@/lib/credits/ledger";
import { notify } from "@/lib/notifications";

const schema = z.object({
  amount: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, "Amount can't be zero"),
  kind: z.enum(["PROMOTIONAL", "ADMIN_ADJUSTMENT"]),
  reason: z.string().trim().min(5, "A reason is required (at least 5 characters)").max(500),
  idempotencyKey: z.string().min(8).max(100),
});

/** Promotional grants / manual adjustments – always with a mandatory reason, audited, and idempotent. */
export const POST = route({ auth: "admin" }, async ({ user: admin, params, json, ip }) => {
  const input = await json(schema);
  if (input.kind === "PROMOTIONAL" && input.amount < 0) throw new AppError("VALIDATION", "Promotional credits must be positive");
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target || target.status === "DELETED") throw notFound("User");
  const result = await applyCreditChange({
    userId: target.id,
    amount: input.amount,
    type: input.kind,
    idempotencyKey: `admin:${admin.id}:${input.idempotencyKey}`,
    description: input.kind === "PROMOTIONAL" ? `Promotional credits` : `Adjustment by administrator`,
    reason: input.reason,
    adminId: admin.id,
  });
  if (!result.duplicate) {
    await audit(admin.id, "credits.adjust", { type: "User", id: target.id }, { amount: input.amount, kind: input.kind, reason: input.reason, transactionId: result.transactionId }, ip);
    if (input.amount > 0) void notify({ userId: target.id, type: "CREDITS_GRANTED", title: "Credits added", body: `${input.amount} credits were added to your wallet: ${input.reason}`, link: "/transactions" });
  }
  return result;
});
