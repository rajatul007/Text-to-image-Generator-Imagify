import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route({ auth: "admin" }, async ({ query }) => {
  const input = query(z.object({ status: z.enum(["RECEIVED", "PROCESSED", "IGNORED", "FAILED"]).optional(), page: z.coerce.number().int().min(1).default(1) }));
  const where = input.status ? { status: input.status } : {};
  const [total, items] = await Promise.all([
    db.paymentWebhookEvent.count({ where }),
    db.paymentWebhookEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * 30, take: 30, select: { id: true, eventId: true, event: true, status: true, signatureValid: true, error: true, createdAt: true, processedAt: true } }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 30)), items };
});
