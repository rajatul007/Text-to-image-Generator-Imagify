import { AppError } from "./errors";
import { getRedis } from "./redis";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "login". */
  name: string;
  limit: number;
  windowSec: number;
}

export const RULES = {
  login: { name: "login", limit: 10, windowSec: 15 * 60 },
  loginEmail: { name: "login-email", limit: 5, windowSec: 15 * 60 },
  signup: { name: "signup", limit: 5, windowSec: 60 * 60 },
  passwordReset: { name: "pw-reset", limit: 5, windowSec: 60 * 60 },
  verifyEmail: { name: "verify-email", limit: 5, windowSec: 60 * 60 },
  enhance: { name: "enhance", limit: 30, windowSec: 60 * 60 },
  generate: { name: "generate", limit: 60, windowSec: 60 * 60 },
  upload: { name: "upload", limit: 40, windowSec: 60 * 60 },
  report: { name: "report", limit: 20, windowSec: 60 * 60 },
  checkout: { name: "checkout", limit: 20, windowSec: 60 * 60 },
  publicApi: { name: "public", limit: 300, windowSec: 60 },
  mutation: { name: "mutation", limit: 240, windowSec: 60 },
} satisfies Record<string, RateLimitRule>;

// In-memory fallback (single instance only). Use Redis in production.
const memory = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
}

export async function checkRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  if (process.env.DISABLE_RATE_LIMIT === "1") return { allowed: true, remaining: rule.limit, resetInSec: 0 };
  const key = `rl:${rule.name}:${identifier}`;
  const redis = getRedis();
  if (redis) {
    try {
      const results = await redis.multi().incr(key).ttl(key).exec();
      const count = Number(results?.[0]?.[1] ?? 0);
      let ttl = Number(results?.[1]?.[1] ?? -1);
      if (ttl < 0) {
        await redis.expire(key, rule.windowSec);
        ttl = rule.windowSec;
      }
      return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), resetInSec: ttl };
    } catch {
      // fall through to memory if Redis is unreachable – availability over strictness
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + rule.windowSec * 1000 });
    if (memory.size > 50_000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return { allowed: true, remaining: rule.limit - 1, resetInSec: rule.windowSec };
  }
  entry.count += 1;
  return { allowed: entry.count <= rule.limit, remaining: Math.max(0, rule.limit - entry.count), resetInSec: Math.ceil((entry.resetAt - now) / 1000) };
}

export async function enforceRateLimit(rule: RateLimitRule, identifier: string) {
  const res = await checkRateLimit(rule, identifier);
  if (!res.allowed) {
    const minutes = Math.max(1, Math.ceil(res.resetInSec / 60));
    throw new AppError("RATE_LIMITED", `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, {
      retryAfter: res.resetInSec,
    });
  }
}

export async function resetRateLimit(rule: RateLimitRule, identifier: string) {
  const key = `rl:${rule.name}:${identifier}`;
  memory.delete(key);
  const redis = getRedis();
  if (redis) await redis.del(key).catch(() => undefined);
}
