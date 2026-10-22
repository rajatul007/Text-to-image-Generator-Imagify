import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "./errors";
import { getSessionUser, type SessionUser } from "./auth/session";
import { enforceRateLimit, RULES, type RateLimitRule } from "./rate-limit";
import { recordError } from "./logger";

type AuthMode = "none" | "optional" | "user" | "admin";

interface RouteOptions {
  auth?: AuthMode;
  /** Require a verified email address. */
  verified?: boolean;
  rateLimit?: RateLimitRule;
  /** Enforce same-origin for state-changing requests (default true when cookies are used). */
  csrf?: boolean;
}

export interface RouteContext<U> {
  req: NextRequest;
  user: U;
  params: Record<string, string>;
  ip: string;
  json<T>(schema: ZodType<T>): Promise<T>;
  query<T>(schema: ZodType<T>): T;
}

type UserFor<A extends AuthMode | undefined> = A extends "user" | "admin" ? SessionUser : SessionUser | null;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const allowed = new Set<string>([new URL(process.env.APP_URL ?? "http://localhost:3000").host]);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) allowed.add(host);
    return allowed.has(o.host);
  } catch {
    return false;
  }
}

export function errorResponse(err: unknown, context: Record<string, unknown> = {}, userId?: string) {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    const retry = (err.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (retry) headers["Retry-After"] = String(retry);
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    return NextResponse.json({ error: { code: "VALIDATION", message: err.issues[0]?.message ?? "Invalid input", fields } }, { status: 422 });
  }
  void recordError("api", err, context, userId);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export function route<A extends AuthMode | undefined = "user">(
  opts: RouteOptions & { auth?: A },
  handler: (ctx: RouteContext<UserFor<A>>) => Promise<Response | unknown>,
) {
  const auth: AuthMode = opts.auth ?? "user";
  return async (req: NextRequest, segment: { params: Promise<Record<string, string | string[]>> }) => {
    let user: SessionUser | null = null;
    try {
      const method = req.method.toUpperCase();
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (mutating && (opts.csrf ?? auth !== "none") && !isSameOrigin(req)) {
        throw new AppError("FORBIDDEN", "Cross-site request blocked");
      }
      if (auth !== "none") user = await getSessionUser();
      if ((auth === "user" || auth === "admin") && !user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue");
      if (auth === "admin" && user?.role !== "ADMIN") throw new AppError("FORBIDDEN", "Administrator access required");
      if (opts.verified && user && !user.emailVerified) throw new AppError("EMAIL_NOT_VERIFIED", "Please verify your email address first");
      const ip = clientIp(req);
      if (opts.rateLimit) await enforceRateLimit(opts.rateLimit, user?.id ?? ip);
      else if (mutating) await enforceRateLimit(RULES.mutation, user?.id ?? ip);

      const rawParams = segment?.params ? await segment.params : {};
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawParams)) params[k] = Array.isArray(v) ? v.join("/") : v;

      const ctx: RouteContext<UserFor<A>> = {
        req,
        user: user as UserFor<A>,
        params,
        ip,
        async json(schema) {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            throw new AppError("BAD_REQUEST", "Request body must be valid JSON");
          }
          return schema.parse(body);
        },
        query(schema) {
          return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
        },
      };
      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err, { path: req.nextUrl.pathname, method: req.method }, user?.id);
    }
  };
}
