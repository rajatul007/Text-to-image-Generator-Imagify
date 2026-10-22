import nodemailer from "nodemailer";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import type { EmailContent } from "./templates";

export interface SendResult {
  ok: boolean;
  error?: string;
}

async function sendViaResend(to: string, content: EmailContent): Promise<void> {
  const e = env();
  if (!e.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.EMAIL_FROM, to: [to], subject: content.subject, html: content.html, text: content.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${body.slice(0, 200)}`);
  }
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
async function sendViaSmtp(to: string, content: EmailContent): Promise<void> {
  const e = env();
  if (!e.SMTP_HOST) throw new Error("SMTP_HOST is not configured");
  transporter ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    connectionTimeout: 15_000,
  });
  await transporter.sendMail({ from: e.EMAIL_FROM, to, subject: content.subject, html: content.html, text: content.text });
}

/**
 * Sends a transactional email and records the outcome in EmailLog. Never throws – callers decide how to
 * surface failures (e.g. "we couldn't send the verification email, try again").
 */
export async function sendEmail(to: string, template: string, content: EmailContent): Promise<SendResult> {
  const provider = env().EMAIL_PROVIDER;
  try {
    if (provider === "resend") await sendViaResend(to, content);
    else if (provider === "smtp") await sendViaSmtp(to, content);
    else logger.info("email (console provider – not delivered)", { to, subject: content.subject, text: content.text });
    await db.emailLog.create({
      data: { to, template, subject: content.subject, provider, status: provider === "console" ? "SKIPPED" : "SENT", devBody: provider === "console" ? content.text : null },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("email delivery failed", { to, template, provider, error: message });
    await db.emailLog.create({ data: { to, template, subject: content.subject, provider, status: "FAILED", error: message.slice(0, 500) } }).catch(() => undefined);
    return { ok: false, error: message };
  }
}
