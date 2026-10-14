import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const username = process.argv[2] ?? "sweps";
  const password = process.argv[3] ?? "Password01";
  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    console.error("User not found:", username);
    process.exit(1);
  }
  await db.user.update({
    where: { username },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      active: true,
    },
  });
  console.log(`Password reset for ${username} → ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
