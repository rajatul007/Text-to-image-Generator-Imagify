import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { storage, type Scope } from "./scope";
import { createUser } from "@/lib/auth/accounts";
import { applyCreditChange } from "@/lib/credits/ledger";
import { randomToken, sha256 } from "@/lib/crypto";
import { SEED_MODELS, SEED_PACKAGES, SEED_PLANS } from "@/data/seed-models";
import sharp from "sharp";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  session?: string | null;
  params?: Record<string, string>;
  query?: Record<string, string>;
  origin?: string | null;
}

/** Invokes a Next.js route handler as if it were a real HTTP request. */
export async function call(handler: Handler, path: string, opts: CallOptions = {}) {
  const url = new URL(`http://localhost:3000${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const method = opts.method ?? (opts.body !== undefined || opts.rawBody ? "POST" : "GET");
  const headers = new Headers(opts.headers);
  if (opts.origin !== null && method !== "GET") headers.set("origin", opts.origin ?? "http://localhost:3000");
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  headers.set("x-forwarded-for", headers.get("x-forwarded-for") ?? "10.0.0.1");
  const scope: Scope = { cookies: new Map(opts.session ? [["pf_session", opts.session]] : []), headers, setCookies: [] };
  const req = new NextRequest(url, { method, headers, body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  const res = await storage.run(scope, () => handler(req, { params: Promise.resolve(opts.params ?? {}) }));
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper returns loosely-typed JSON
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers, setCookies: [...scope.setCookies] };
}

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  // TRUNCATE bypasses the row-level immutability trigger on the ledger (tests only).
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  for (const m of SEED_MODELS) await db.aiModel.create({ data: m });
  for (const p of SEED_PACKAGES) await db.creditPackage.create({ data: p });
  for (const p of SEED_PLANS) await db.subscriptionPlan.create({ data: { ...p, razorpayPlanId: `plan_${p.slug.replace(/-/g, "")}` } });
}

let counter = 0;
/** Creates a verified (or unverified) user with a session and an optional starting balance. */
export async function makeUser(opts: { credits?: number; verified?: boolean; admin?: boolean; email?: string } = {}) {
  counter += 1;
  const email = opts.email ?? `user${counter}-${Date.now()}@example.com`;
  const user = await createUser({ name: `Test User ${counter}`, email, password: "password123", emailVerified: opts.verified ?? true });
  if (opts.admin) await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  if (opts.credits) await applyCreditChange({ userId: user.id, amount: opts.credits, type: "PROMOTIONAL", idempotencyKey: `test-seed:${user.id}`, description: "test credits" });
  const token = randomToken(32);
  await db.session.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) } });
  return { user, session: token, email };
}

export async function balanceOf(userId: string) {
  return (await db.creditWallet.findUnique({ where: { userId } }))?.balance ?? 0;
}

export async function pngBuffer(w = 64, h = 64, hue = 200) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: hue % 255, g: 80, b: 160 } } }).png().toBuffer();
}

type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Routes outgoing fetch() calls to per-host fake handlers (provider/payment HTTP test doubles). */
export function installFetch(routes: Record<string, FetchHandler>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    for (const [prefix, handler] of Object.entries(routes)) if (url.startsWith(prefix)) return handler(url, init);
    throw new Error(`Unexpected fetch to ${url}`);
  };
  globalThis.fetch = fake as typeof fetch;
  return calls;
}

export async function stabilityOk(seedHeader?: number) {
  const data = await pngBuffer(96, 64);
  return new Response(new Uint8Array(data), { status: 200, headers: { "content-type": "image/png", "finish-reason": "SUCCESS", ...(seedHeader != null ? { seed: String(seedHeader) } : {}) } });
}
