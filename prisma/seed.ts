import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  const existing = await db.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existing) {
    await db.user.create({
      data: {
        username: adminUsername,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
      },
    });
    console.log(`Created admin user: ${adminUsername}`);
  } else {
    console.log(`Admin user already exists: ${adminUsername}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
