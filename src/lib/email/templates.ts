export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta?: { label: string; url: string }, footer?: string) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(cta.url)}" style="background:linear-gradient(90deg,#7c3aed,#2563eb);color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>
       <p style="color:#6b7280;font-size:12px">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${esc(cta.url)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0b0b14;padding:32px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="padding:22px 28px;background:linear-gradient(90deg,#4c1d95,#1e3a8a);color:#fff;font-weight:700;font-size:18px">✦ Text to Image Generator</td></tr>
    <tr><td style="padding:28px;color:#111827;font-size:15px;line-height:1.6">
      <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
      ${body}
      ${button}
    </td></tr>
    <tr><td style="padding:16px 28px;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6">${footer ?? "You received this email because of activity on your Text to Image Generator account."}</td></tr>
  </table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${esc(s)}</p>`;

export const templates = {
  verifyEmail: (name: string, url: string): EmailContent => ({
    subject: "Verify your Text to Image Generator email",
    html: layout(`Welcome, ${name}!`, p("Confirm your email address to activate your account and receive your welcome credits. This link expires in 24 hours."), {
      label: "Verify email",
      url,
    }),
    text: `Welcome to Text to Image Generator, ${name}!\n\nVerify your email (link expires in 24 hours):\n${url}`,
  }),
  passwordReset: (name: string, url: string): EmailContent => ({
    subject: "Reset your Text to Image Generator password",
    html: layout("Password reset requested", p(`Hi ${name}, we received a request to reset your password. This link expires in 1 hour. If you didn't request it, you can ignore this email.`), {
      label: "Reset password",
      url,
    }),
    text: `Hi ${name},\n\nReset your password (expires in 1 hour):\n${url}\n\nIf you didn't request this, ignore this email.`,
  }),
  passwordChanged: (name: string): EmailContent => ({
    subject: "Your Text to Image Generator password was changed",
    html: layout("Password changed", p(`Hi ${name}, your password was just changed and other sessions were signed out. If this wasn't you, reset your password immediately and contact support.`)),
    text: `Hi ${name}, your password was just changed. If this wasn't you, reset your password immediately.`,
  }),
  generationComplete: (name: string, count: number, url: string): EmailContent => ({
    subject: "Your images are ready",
    html: layout("Your generation is complete", p(`Hi ${name}, ${count} new image${count === 1 ? " is" : "s are"} waiting in your gallery.`), { label: "View images", url }),
    text: `Hi ${name}, ${count} new image(s) are ready: ${url}`,
  }),
  generationFailed: (name: string, credits: number, url: string): EmailContent => ({
    subject: "A generation failed – credits refunded",
    html: layout("Generation failed", p(`Hi ${name}, one of your generations could not be completed. ${credits} credit${credits === 1 ? " has" : "s have"} been refunded to your wallet. Your prompt is saved, so you can try again.`), {
      label: "Open history",
      url,
    }),
    text: `Hi ${name}, a generation failed and ${credits} credits were refunded. Retry from: ${url}`,
  }),
  lowCredits: (name: string, balance: number, url: string): EmailContent => ({
    subject: "You're running low on credits",
    html: layout("Low credit balance", p(`Hi ${name}, you have ${balance} credit${balance === 1 ? "" : "s"} left.`), { label: "Top up credits", url }),
    text: `Hi ${name}, you have ${balance} credits left. Top up: ${url}`,
  }),
  paymentSuccess: (name: string, credits: number, amount: string, url: string): EmailContent => ({
    subject: "Payment received – credits added",
    html: layout("Thanks for your purchase!", p(`Hi ${name}, we received your payment of ${amount}. ${credits} credits have been added to your wallet.`), { label: "View receipt", url }),
    text: `Hi ${name}, payment of ${amount} received. ${credits} credits added. Receipt: ${url}`,
  }),
  paymentFailed: (name: string, amount: string, url: string): EmailContent => ({
    subject: "Payment failed",
    html: layout("Your payment didn't go through", p(`Hi ${name}, your payment of ${amount} failed. No credits were added and, if any amount was debited, your bank will reverse it automatically.`), {
      label: "Try again",
      url,
    }),
    text: `Hi ${name}, your payment of ${amount} failed. Try again: ${url}`,
  }),
  refundProcessed: (name: string, amount: string, credits: number): EmailContent => ({
    subject: "Refund processed",
    html: layout("Refund processed", p(`Hi ${name}, a refund of ${amount} has been processed.${credits > 0 ? ` ${credits} credits were removed from your wallet.` : ""}`)),
    text: `Hi ${name}, a refund of ${amount} has been processed.`,
  }),
};

export type TemplateName = keyof typeof templates;
