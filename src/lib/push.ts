import webpush from "web-push";
import { db } from "@/lib/db";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

function configureWebPush(): void {
  if (!isPushConfigured()) {
    throw new Error("PUSH_NOT_CONFIGURED");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

type SendResult = { sent: number; failed: number; removed: number };

type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPushToSubscription(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<"sent" | "failed" | "removed"> {
  configureWebPush();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : 0;

    if (statusCode === 404 || statusCode === 410) {
      await db.pushSubscription.delete({ where: { id: subscription.id } });
      return "removed";
    }

    return "failed";
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendResult> {
  configureWebPush();

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  });

  const result: SendResult = { sent: 0, failed: 0, removed: 0 };

  for (const subscription of subscriptions) {
    const outcome = await sendPushToSubscription(subscription, payload);
    result[outcome] += 1;
  }

  return result;
}
