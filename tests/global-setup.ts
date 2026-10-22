import pg from "pg";
import { applyMigrations } from "../scripts/migrate-offline";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://pixelforge:pixelforge@localhost:5432/pixelforge_test";

/** Recreates the test schema from the real migrations before the run. */
export default async function setup() {
  const client = new pg.Client({ connectionString: TEST_DB });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  await applyMigrations(TEST_DB, () => undefined);
}
