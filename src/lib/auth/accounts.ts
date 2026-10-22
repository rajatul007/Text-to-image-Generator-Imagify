import type { TokenType } from "@prisma/client";
import { db, type Tx } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "../crypto";
import { AppError } from "../errors";
import { sendEmail } from "../email";
import { templates } from "../email/templates";
import { applyCreditChange } from "../credits/ledger";
import { getSettings } from "../settings";
import { hashPassword } from "./password";

const TOKEN_TTL: Record<TokenType, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function uniqueUsername(base: string, tx: Tx | typeof db = db) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "creator";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await tx.profile.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${slug}${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export async function createUser(input: { name: string; email: string; password?: string; emailVerified?: boolean }) {
  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new AppError("CONFLICT", "An account with this email already exists");
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  return db.$transaction(async (tx) => {
    const username = await uniqueUsername(input.name || email.split("@")[0], tx);
    const user = await tx.user.create({
      data: {
        email,
        name: input.name.trim(),
        passwordHash,
        emailVerified: input.emailVerified ? new Date() : null,
        // role is never accepted from user input – admins are promoted via `npm run admin:promote`.
        profile: { create: { username, displayName: input.name.trim() } },
        wallet: { create: {} },
      },
    });
    return user;
  });
}

export async function issueToken(userId: string, type: TokenType) {
  const token = randomToken(32);
  await db.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.verificationToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) } });
  return token;
}

/** Atomically consumes a single-use token. */
export async function consumeToken(token: string, type: TokenType) {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== type) throw new AppError("BAD_REQUEST", "This link is invalid. Please request a new one.");
  if (record.usedAt) throw new AppError("BAD_REQUEST", "This link has already been used.");
  if (record.expiresAt.getTime() < Date.now()) throw new AppError("BAD_REQUEST", "This link has expired. Please request a new one.");
  const updated = await db.verificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (updated.count !== 1) throw new AppError("BAD_REQUEST", "This link has already been used.");
  return record;
}

export async function sendVerificationEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const url = `${env().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail(user.email, "verifyEmail", templates.verifyEmail(user.name, url));
}

export async function sendPasswordResetEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "PASSWORD_RESET");
  const url = `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail(user.email, "passwordReset", templates.passwordReset(user.name, url));
}

/** Grants the configurable welcome bonus once per verified account (idempotent). */
export async function grantWelcomeBonus(userId: string) {
  const { welcomeCredits } = await getSettings();
  if (welcomeCredits <= 0) return null;
  return applyCreditChange({
    userId,
    amount: welcomeCredits,
    type: "WELCOME_BONUS",
    idempotencyKey: `welcome:${userId}`,
    description: `Welcome bonus – ${welcomeCredits} credits`,
  });
}

export async function markEmailVerified(userId: string) {
  await db.user.updateMany({ where: { id: userId, emailVerified: null }, data: { emailVerified: new Date() } });
  await grantWelcomeBonus(userId);
}
