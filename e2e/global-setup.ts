import pg from "pg";
import { applyMigrations } from "../scripts/migrate-offline";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://pixelforge:pixelforge@localhost:5432/pixelforge_e2e";
  const admin = new pg.Client({ connectionString: url.replace(/\/[^/?]+(\?|$)/, "/postgres$1") });
  await admin.connect();
  const db = new URL(url).pathname.slice(1);
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${db}"`);
  await admin.end();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  await applyMigrations(url, () => undefined);
  process.env.DATABASE_URL = url;
  const { execSync } = await import("node:child_process");
  execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
