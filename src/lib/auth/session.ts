import "server-only";
import { cookies, headers } from "next/headers";
import type { Role, UserStatus } from "@prisma/client";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000; // slide expiry at most once a day

export function sessionCookieName() {
  return (process.env.APP_URL ?? "").startsWith("https://") ? "__Host-pf_session" : "pf_session";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerified: Date | null;
  hasPassword: boolean;
  username: string | null;
  avatarKey: string | null;
  sessionId: string;
}

export async function clientMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const meta = await clientMeta();
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS), ip: meta.ip, userAgent: meta.userAgent },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(sessionCookieName())?.value ?? null;
}

/** Validates the session cookie against the database. Returns null for missing/expired/suspended sessions. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSessionToken(token);
}

export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { profile: { select: { username: true, avatarKey: true } } } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
      .catch(() => undefined);
  }
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    hasPassword: Boolean(u.passwordHash),
    username: u.profile?.username ?? null,
    avatarKey: u.profile?.avatarKey ?? null,
    sessionId: session.id,
  };
}

export async function destroyCurrentSession() {
  const token = await readSessionToken();
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  const jar = await cookies();
  jar.delete(sessionCookieName());
}

export async function destroyOtherSessions(userId: string, keepSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) } });
}
