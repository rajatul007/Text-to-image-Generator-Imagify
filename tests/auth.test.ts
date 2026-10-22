import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as adminAnalytics } from "@/app/api/admin/analytics/route";
import { balanceOf, call, makeUser, resetDb } from "./helpers";

async function lastEmailToken(email: string, template: string) {
  const log = await db.emailLog.findFirst({ where: { to: email, template }, orderBy: { createdAt: "desc" } });
  return /token=([^\s&]+)/.exec(log?.devBody ?? "")?.[1] ?? "";
}

describe("authentication", () => {
  beforeEach(resetDb);

  it("signs up with a hashed password, a session cookie, and never grants admin from input", async () => {
    const res = await call(signup, "/api/auth/signup", { body: { name: "Riya", email: "Riya@Example.com", password: "secret123", role: "ADMIN" } });
    expect(res.status).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { email: "riya@example.com" } });
    expect(user.role).toBe("USER");
    expect(user.passwordHash).not.toContain("secret123");
    expect(user.passwordHash?.startsWith("$2")).toBe(true);
    const cookie = res.setCookies.find((c) => c.name === "pf_session");
    expect(cookie?.opts.httpOnly).toBe(true);
    expect(cookie?.opts.sameSite).toBe("lax");
    // session token is stored hashed
    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).not.toBe(cookie?.value);
  });

  it("rejects duplicate emails and weak passwords", async () => {
    await call(signup, "/api/auth/signup", { body: { name: "A B", email: "dup@example.com", password: "secret123" } });
    const dup = await call(signup, "/api/auth/signup", { body: { name: "A B", email: "dup@example.com", password: "secret123" } });
    expect(dup.status).toBe(409);
    const weak = await call(signup, "/api/auth/signup", { body: { name: "A B", email: "weak@example.com", password: "short" } });
    expect(weak.status).toBe(422);
  });

  it("grants the welcome bonus exactly once on email verification", async () => {
    await call(signup, "/api/auth/signup", { body: { name: "Vee", email: "vee@example.com", password: "secret123" } });
    const user = await db.user.findUniqueOrThrow({ where: { email: "vee@example.com" } });
    expect(await balanceOf(user.id)).toBe(0);
    const token = await lastEmailToken("vee@example.com", "verifyEmail");
    const ok = await call(verifyEmail, "/api/auth/verify-email", { body: { token } });
    expect(ok.status).toBe(200);
    expect(await balanceOf(user.id)).toBe(25);
    const again = await call(verifyEmail, "/api/auth/verify-email", { body: { token } });
    expect(again.status).toBe(400);
    expect(await balanceOf(user.id)).toBe(25);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: "WELCOME_BONUS" } })).toBe(1);
  });

  it("logs in with correct credentials and gives a generic error otherwise", async () => {
    const { email } = await makeUser();
    const bad = await call(login, "/api/auth/login", { body: { email, password: "wrong-password1" } });
    expect(bad.status).toBe(401);
    const unknown = await call(login, "/api/auth/login", { body: { email: "nobody@example.com", password: "whatever1" } });
    expect(unknown.json.error.message).toBe(bad.json.error.message);
    const good = await call(login, "/api/auth/login", { body: { email, password: "password123" } });
    expect(good.status).toBe(200);
  });

  it("rate-limits brute-force login attempts per email", async () => {
    const { email } = await makeUser();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await call(login, "/api/auth/login", { body: { email, password: `nope${i}xx1` }, headers: { "x-forwarded-for": `10.1.0.${i}` } })).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("blocks suspended users and invalidates their sessions", async () => {
    const { user, email, session } = await makeUser();
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    const res = await call(login, "/api/auth/login", { body: { email, password: "password123" } });
    expect(res.status).toBe(403);
    const who = await call(me, "/api/auth/me", { session });
    expect(who.json.user).toBeNull();
  });

  it("password reset: generic response, single-use token, signs out all sessions", async () => {
    const { user, email, session } = await makeUser();
    const r1 = await call(forgot, "/api/auth/forgot-password", { body: { email } });
    const r2 = await call(forgot, "/api/auth/forgot-password", { body: { email: "missing@example.com" } });
    expect(r1.json.message).toBe(r2.json.message);
    const token = await lastEmailToken(email, "passwordReset");
    expect(token).not.toBe("");
    const ok = await call(reset, "/api/auth/reset-password", { body: { token, password: "newpass123" } });
    expect(ok.status).toBe(200);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await call(me, "/api/auth/me", { session })).json.user).toBeNull();
    const reuse = await call(reset, "/api/auth/reset-password", { body: { token, password: "another123" } });
    expect(reuse.status).toBe(400);
    expect((await call(login, "/api/auth/login", { body: { email, password: "newpass123" } })).status).toBe(200);
  });

  it("blocks cross-site state-changing requests (CSRF)", async () => {
    const res = await call(signup, "/api/auth/signup", { body: { name: "Evil", email: "evil@example.com", password: "secret123" }, origin: "https://evil.example" });
    expect(res.status).toBe(403);
    const none = await call(signup, "/api/auth/signup", { body: { name: "Evil", email: "evil2@example.com", password: "secret123" }, origin: null });
    expect(none.status).toBe(403);
  });

  it("protects admin APIs with server-side role checks", async () => {
    const anon = await call(adminAnalytics, "/api/admin/analytics");
    expect(anon.status).toBe(401);
    const { session } = await makeUser();
    expect((await call(adminAnalytics, "/api/admin/analytics", { session })).status).toBe(403);
    const admin = await makeUser({ admin: true });
    expect((await call(adminAnalytics, "/api/admin/analytics", { session: admin.session })).status).toBe(200);
  });
});

describe("admin bootstrap via ADMIN_EMAILS", () => {
  beforeEach(resetDb);
  it("promotes only a verified account whose email is configured server-side", async () => {
    const { resetEnvCache } = await import("@/lib/env");
    process.env.ADMIN_EMAILS = "Boss@Example.com, other@example.com";
    resetEnvCache();
    try {
      await call(signup, "/api/auth/signup", { body: { name: "Boss", email: "boss@example.com", password: "secret123" }, headers: { "x-forwarded-for": "10.9.9.1" } });
      const user = await db.user.findUniqueOrThrow({ where: { email: "boss@example.com" } });
      expect(user.role).toBe("USER"); // not before verification
      const token = await lastEmailToken("boss@example.com", "verifyEmail");
      await call(verifyEmail, "/api/auth/verify-email", { body: { token }, headers: { "x-forwarded-for": "10.9.9.3" } });
      expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("ADMIN");
      await call(signup, "/api/auth/signup", { body: { name: "Rando", email: "rando@example.com", password: "secret123" }, headers: { "x-forwarded-for": "10.9.9.2" } });
      const t2 = await lastEmailToken("rando@example.com", "verifyEmail");
      await call(verifyEmail, "/api/auth/verify-email", { body: { token: t2 }, headers: { "x-forwarded-for": "10.9.9.4" } });
      expect((await db.user.findUniqueOrThrow({ where: { email: "rando@example.com" } })).role).toBe("USER");
    } finally {
      delete process.env.ADMIN_EMAILS;
      resetEnvCache();
    }
  });
});
