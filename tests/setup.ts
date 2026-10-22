import { vi } from "vitest";
import os from "node:os";
import path from "node:path";

// ── Environment for the test run (never touches development data) ──
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://pixelforge:pixelforge@localhost:5432/pixelforge_test",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
  JOB_RUNNER: "worker",
  EMAIL_PROVIDER: "console",
  STORAGE_DRIVER: "local",
  LOCAL_STORAGE_DIR: path.join(os.tmpdir(), "pixelforge-test-storage"),
  STABILITY_API_KEY: "test-stability",
  STABILITY_API_BASE: "http://stability.test",
  REPLICATE_API_TOKEN: "",
  OPENAI_API_KEY: "",
  CLIPDROP_API_KEY: "",
  LLM_API_KEY: "test-llm",
  LLM_API_BASE: "http://llm.test/v1",
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "rzp_test_secret",
  RAZORPAY_WEBHOOK_SECRET: "whsec_test",
  RAZORPAY_API_BASE: "http://razorpay.test/v1",
  REDIS_URL: "",
  IMAGE_PROVIDER_TIMEOUT_MS: "5000",
});

vi.mock("server-only", () => ({}));

// ── Minimal request-scope emulation for next/headers (cookies/headers) ──
vi.mock("next/headers", async () => {
  const { scope } = await import("./helpers/scope");
  return {
    cookies: async () => {
      const s = scope();
      return {
        get: (name: string) => (s.cookies.has(name) ? { name, value: s.cookies.get(name)! } : undefined),
        has: (name: string) => s.cookies.has(name),
        set: (name: string, value: string, opts?: Record<string, unknown>) => {
          s.cookies.set(name, value);
          s.setCookies.push({ name, value, opts: opts ?? {} });
        },
        delete: (name: string) => {
          s.cookies.delete(name);
          s.setCookies.push({ name, value: "", opts: { deleted: true } });
        },
      };
    },
    headers: async () => scope().headers,
  };
});

vi.mock("next/server", async (orig) => {
  const actual = await orig<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => void Promise.resolve().then(fn) };
});
