import webpush from "web-push";
import type { PushSubscription } from "web-push";
import { env, isWebPushConfigured } from "@/lib/env";
import type { PushPayload, PushSubscriptionRecord } from "@/lib/types/notistock";

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
) {
  if (!isWebPushConfigured) {
    return {
      ok: false,
      simulated: true,
      error: "Web Push VAPID keys are not configured.",
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
      };
    }

    await webpush.sendNotification(webPushSubscription, JSON.stringify(payload));
    return { ok: true, simulated: false, error: null };
  } catch (error) {
    return {
      ok: false,
      simulated: false,
      error: error instanceof Error ? error.message : "Unknown push failure",
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
