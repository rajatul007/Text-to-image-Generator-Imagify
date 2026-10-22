import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Image providers (configure at least one)
  STABILITY_API_KEY: z.string().optional(),
  STABILITY_API_BASE: z.string().url().default("https://api.stability.ai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE: z.string().url().default("https://api.openai.com/v1"),
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_API_BASE: z.string().url().default("https://api.replicate.com/v1"),
  CLIPDROP_API_KEY: z.string().optional(),
  CLIPDROP_API_BASE: z.string().url().default("https://clipdrop-api.co"),
  IMAGE_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  // LLM for prompt enhancement
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  LLM_API_KEY: z.string().optional(),
  LLM_API_BASE: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  // Moderation
  OPENAI_MODERATION: bool,
  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_API_BASE: z.string().url().default("https://api.razorpay.com/v1"),
  // Storage
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  // Email
  EMAIL_PROVIDER: z.enum(["resend", "smtp", "console"]).default("console"),
  EMAIL_FROM: z.string().default("Text to Image Generator <no-reply@localhost>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: bool,
  // Infra
  REDIS_URL: z.string().optional(),
  JOB_RUNNER: z.enum(["inline", "worker"]).default("inline"),
  SUPPORT_EMAIL: z.string().default("support@example.com"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.STORAGE_DRIVER === "local")
      console.warn("[pixelforge] STORAGE_DRIVER=local in production – use S3-compatible storage for multi-instance deployments.");
    if (parsed.data.EMAIL_PROVIDER === "console")
      console.warn("[pixelforge] EMAIL_PROVIDER=console in production – emails will NOT be delivered.");
  }
  cached = parsed.data;
  return cached;
}

/** Test helper – forces env to be re-read. */
export function resetEnvCache() {
  cached = null;
}

export const isProd = () => env().NODE_ENV === "production";

export function integrationStatus() {
  const e = env();
  return {
    google: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    stability: Boolean(e.STABILITY_API_KEY),
    openai: Boolean(e.OPENAI_API_KEY),
    replicate: Boolean(e.REPLICATE_API_TOKEN),
    clipdrop: Boolean(e.CLIPDROP_API_KEY),
    llm: Boolean(e.LLM_API_KEY),
    razorpay: Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET),
    razorpayWebhook: Boolean(e.RAZORPAY_WEBHOOK_SECRET),
    s3: e.STORAGE_DRIVER === "s3" && Boolean(e.S3_BUCKET && e.S3_ACCESS_KEY_ID),
    email: e.EMAIL_PROVIDER !== "console",
    redis: Boolean(e.REDIS_URL),
  };
}
