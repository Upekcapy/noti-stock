import webpush from "web-push";
import type { PushSubscription } from "web-push";
import { env, isWebPushConfigured } from "@/lib/env";
import type { PushPayload, PushSubscriptionRecord } from "@/lib/types/notistock";

export type PushSendResult = {
  ok: boolean;
  simulated: boolean;
  error: string | null;
  expired: boolean;
};

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!isWebPushConfigured) {
    return {
      ok: false,
      simulated: true,
      error: "Web Push VAPID keys are not configured.",
      expired: false,
    };
  }

  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);

  try {
    const webPushSubscription = toWebPushSubscription(subscription.subscription);
    if (!webPushSubscription) {
      return {
        ok: false,
        simulated: false,
        error: "Push subscription is missing endpoint or keys.",
        expired: true,
      };
    }

    await webpush.sendNotification(webPushSubscription, JSON.stringify(payload));
    return { ok: true, simulated: false, error: null, expired: false };
  } catch (error) {
    return {
      ok: false,
      simulated: false,
      error: formatPushError(error),
      expired: isExpiredSubscriptionError(error),
    };
  }
}

function toWebPushSubscription(
  subscription: PushSubscriptionJSON,
): PushSubscription | null {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh,
      auth,
    },
  };
}

function isExpiredSubscriptionError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

function formatPushError(error: unknown) {
  if (error instanceof Error) {
    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number"
        ? ` (${error.statusCode})`
        : "";
    const body =
      "body" in error && typeof error.body === "string" && error.body
        ? `: ${error.body}`
        : "";

    return `${error.message}${statusCode}${body}`;
  }

  return "Unknown push failure";
}
