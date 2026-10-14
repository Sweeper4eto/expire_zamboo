import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const username = process.env.ADMIN_USERNAME ?? "admin";

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 6) {
    console.error("Set ADMIN_PASSWORD (at least 6 characters).");
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { username } });

  if (!user || user.role !== "ADMIN") {
    console.error(`Admin user not found: ${username}`);
    process.exit(1);
  }

  await db.user.update({
    where: { username },
    data: { passwordHash: await hashPassword(password) },
  });

  console.log(`Password updated for admin user: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
