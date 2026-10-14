/**
 * Send one test push to a user (by username).
 *
 *   DATABASE_URL="file:/var/lib/magazin/data.db" npx tsx scripts/send-test-push.ts Sweps
 *
 * Requires VAPID_* in the environment and an existing push subscription
 * (user already toggled notifications on).
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { isPushConfigured, sendPushToUser } from "../src/lib/push";

async function main() {
  const username = process.argv[2]?.trim();
  if (!username) {
    console.error("Usage: npx tsx scripts/send-test-push.ts <username>");
    process.exit(1);
  }

  if (!isPushConfigured()) {
    console.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not set.");
    process.exit(1);
  }

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      pushSubscriptions: { select: { id: true, endpoint: true } },
    },
  });

  if (!user) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  if (user.pushSubscriptions.length === 0) {
    console.error(
      `${username} has no push subscription. Open /app on their phone, enable the alerts toggle, then retry.`,
    );
    process.exit(1);
  }

  const result = await sendPushToUser(user.id, {
    title: "expire365 test",
    body: "If you see this, push notifications are working.",
    url: "/app",
  });

  console.log(
    JSON.stringify(
      {
        username: user.username,
        subscriptions: user.pushSubscriptions.length,
        ...result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
