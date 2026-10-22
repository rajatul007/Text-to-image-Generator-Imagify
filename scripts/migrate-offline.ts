/**
 * Applies pending SQL migrations from prisma/migrations using plain `pg`, recording them in the
 * standard `_prisma_migrations` table so `prisma migrate deploy` / `migrate status` stay compatible.
 *
 * Use this only where Prisma's native schema engine cannot be downloaded (air-gapped CI, sandboxes).
 * Normal environments should run `npm run db:deploy` (prisma migrate deploy).
 *
 *   DATABASE_URL=... npx tsx scripts/migrate-offline.ts
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

export async function applyMigrations(databaseUrl: string, log = console.log) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
    const dir = path.join(process.cwd(), "prisma", "migrations");
    const names = (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const applied = new Set(
      (await client.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows.map(
        (r: { migration_name: string }) => r.migration_name,
      ),
    );
    for (const name of names) {
      if (applied.has(name)) continue;
      const sql = await readFile(path.join(dir, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const id = randomUUID();
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ($1,$2,now(),$3,1)`,
          [id, checksum, name],
        );
        await client.query("COMMIT");
        log(`applied ${name}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  applyMigrations(url).then(
    () => console.log("migrations up to date"),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
