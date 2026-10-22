/**
 * Normalises process.env before anything reads it:
 *  - empty values ("") are treated as "not set" (so a copied .env.example with blank keys is valid)
 *  - APP_URL falls back to the public URL provided by common hosts (Render, Railway, Vercel)
 * Safe to call more than once.
 */
export function bootstrapEnv() {
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v.trim() === "") delete process.env[k];
  // Vercel / Neon integrations may only provide POSTGRES_URL.
  if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) process.env.DATABASE_URL = process.env.POSTGRES_URL;
  if (!process.env.APP_URL) {
    const host =
      process.env.RENDER_EXTERNAL_URL ??
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined) ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
    if (host) process.env.APP_URL = host.replace(/\/$/, "");
  }
}
