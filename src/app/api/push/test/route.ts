import { NextResponse } from "next/server";
import { addNotification, listPushSubscriptions } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { sendPushNotification } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const subscriptions = await listPushSubscriptions(supabase, user.id);
  const payload = {
    title: "NotiStock test alert",
    body: "Notifications are connected for this device.",
    url: "/notifications",
  };

  const results = await Promise.all(
    subscriptions.map((subscription) => sendPushNotification(subscription, payload)),
  );

  const hasSent = results.some((result) => result.ok);
  const simulated = subscriptions.length === 0 || results.some((result) => result.simulated);
  const firstError = results.find((result) => result.error)?.error ?? null;

  await addNotification(supabase, user.id, {
    alertId: null,
    symbol: "TEST",
    title: payload.title,
    body: payload.body,
    targetPrice: null,
    triggerPrice: null,
    deliveryStatus: hasSent ? "sent" : simulated ? "simulated" : "failed",
    errorMessage: hasSent || simulated ? null : firstError,
  });

  return NextResponse.json({
    ok: hasSent || simulated,
    sent: results.filter((result) => result.ok).length,
    simulated,
    subscriptions: subscriptions.length,
  });
}
