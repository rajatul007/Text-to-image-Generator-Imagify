import pg from "pg";

const url = process.env.E2E_DATABASE_URL ?? "postgresql://pixelforge:pixelforge@localhost:5432/pixelforge_e2e";

/** Reads the most recent verification link from the console email log (EMAIL_PROVIDER=console). */
export async function latestEmailLink(to: string, template: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (let i = 0; i < 20; i++) {
      const r = await client.query(`SELECT "devBody" FROM "EmailLog" WHERE "to" = $1 AND template = $2 ORDER BY "createdAt" DESC LIMIT 1`, [to, template]);
      const m = /(https?:\/\/\S+)/.exec(r.rows[0]?.devBody ?? "");
      if (m) return m[1];
      await new Promise((res) => setTimeout(res, 250));
    }
    throw new Error(`No ${template} email for ${to}`);
  } finally {
    await client.end();
  }
}
