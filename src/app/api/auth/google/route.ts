import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { googleAuthUrl, googleConfigured } from "@/lib/auth/google";
import { randomToken } from "@/lib/crypto";
import { checkRateLimit, RULES } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api";

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  if (!googleConfigured()) return NextResponse.redirect(`${appUrl}/login?error=google_not_configured`);
  const rl = await checkRateLimit(RULES.login, clientIp(req));
  if (!rl.allowed) return NextResponse.redirect(`${appUrl}/login?error=rate_limited`);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = req.nextUrl.searchParams.get("next");
  const res = NextResponse.redirect(googleAuthUrl(state, challenge));
  const secure = appUrl.startsWith("https://");
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };
  res.cookies.set("pf_oauth_state", state, opts);
  res.cookies.set("pf_oauth_verifier", verifier, opts);
  if (next && next.startsWith("/") && !next.startsWith("//")) res.cookies.set("pf_oauth_next", next, opts);
  return res;
}
