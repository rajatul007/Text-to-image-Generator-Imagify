/** Promotes an existing, verified user to ADMIN. Admin rights can never be obtained through signup.
 *    npm run admin:promote -- someone@example.com
 */
import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:promote -- <email>");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);
  if (!user.emailVerified) throw new Error("Verify the account's email address before promoting it.");
  await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`${email} is now an administrator.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
