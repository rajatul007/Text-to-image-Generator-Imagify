import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { exchangeGoogleCode, googleConfigured } from "@/lib/auth/google";
import { createUser, grantWelcomeBonus, normalizeEmail } from "@/lib/auth/accounts";
import { createSession } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto";
import { recordError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${appUrl}/login?error=${code}`);
    for (const c of ["pf_oauth_state", "pf_oauth_verifier", "pf_oauth_next"]) res.cookies.delete({ name: c, path: "/api/auth/google" });
    return res;
  };
  if (!googleConfigured()) return fail("google_not_configured");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("pf_oauth_state")?.value;
  const verifier = req.cookies.get("pf_oauth_verifier")?.value;
  if (req.nextUrl.searchParams.get("error")) return fail("google_cancelled");
  if (!code || !state || !savedState || !verifier || !safeEqual(state, savedState)) return fail("google_state");

  try {
    const profile = await exchangeGoogleCode(code, verifier);
    if (!profile.email_verified) return fail("google_unverified");
    const email = normalizeEmail(profile.email);
    const linked = await db.account.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } }, include: { user: true } });
    let user = linked?.user ?? null;
    if (!user) {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        // Google has verified ownership of this email, so it is safe to link to the existing account.
        await db.account.create({ data: { userId: existing.id, provider: "google", providerAccountId: profile.sub } });
        if (!existing.emailVerified) await db.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } });
        user = existing;
      } else {
        user = await createUser({ name: profile.name || email.split("@")[0], email, emailVerified: true });
        await db.account.create({ data: { userId: user.id, provider: "google", providerAccountId: profile.sub } });
      }
      await grantWelcomeBonus(user.id);
    }
    if (user.status === "SUSPENDED") return fail("suspended");
    if (user.status === "DELETED") return fail("google_state");
    await createSession(user.id);
    const next = req.cookies.get("pf_oauth_next")?.value;
    const res = NextResponse.redirect(`${appUrl}${next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"}`);
    for (const c of ["pf_oauth_state", "pf_oauth_verifier", "pf_oauth_next"]) res.cookies.delete({ name: c, path: "/api/auth/google" });
    return res;
  } catch (err) {
    await recordError("google-oauth", err);
    return fail("google_failed");
  }
}
