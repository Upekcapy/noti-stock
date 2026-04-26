import { NextResponse } from "next/server";
import {
  addNotification,
  listPushSubscriptions,
  removePushSubscription,
} from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { sendPushNotification } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

const TEST_STOCKS = [
  { symbol: "NVDA", price: 900 },
  { symbol: "AAPL", price: 275 },
  { symbol: "COST", price: 1000 },
  { symbol: "JPM", price: 250 },
  { symbol: "TSLA", price: 200 },
  { symbol: "MSFT", price: 430 },
];

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createServerSupabaseClient();
    const subscriptions = await listPushSubscriptions(supabase, user.id);
    const stock = TEST_STOCKS[Math.floor(Math.random() * TEST_STOCKS.length)] ?? TEST_STOCKS[0];
    const payload = {
      title: `${stock.symbol} reached ${formatCurrency(stock.price)}`,
      body: `Test alert: ${stock.symbol} crossed your NotiStock target.`,
      symbol: stock.symbol,
      url: `/stocks/${stock.symbol}`,
    };

    const results = await Promise.all(
      subscriptions.map((subscription) => sendPushNotification(subscription, payload)),
    );
    const expiredRemoved = results.filter((result) => result.expired).length;
    const sent = results.filter((result) => result.ok).length;
    const failed = results.filter(
      (result) => !result.ok && !result.simulated && !result.expired,
    ).length;
    await Promise.all(
      subscriptions.map((subscription, index) => {
        if (!results[index]?.expired) return Promise.resolve();
        return removePushSubscription(supabase, user.id, subscription.endpoint);
      }),
    );

    const hasSent = sent > 0;
    const simulated = subscriptions.length === 0 || results.some((result) => result.simulated);
    const firstError = results.find((result) => result.error)?.error ?? null;
    let notificationHistoryError: string | null = null;

    try {
      await addNotification(supabase, user.id, {
        alertId: null,
        symbol: stock.symbol,
        title: payload.title,
        body: payload.body,
        targetPrice: stock.price,
        triggerPrice: stock.price,
        deliveryStatus: hasSent ? "sent" : simulated ? "simulated" : "failed",
        errorMessage: firstError,
      });
    } catch (error) {
      notificationHistoryError = formatRouteError(error);
    }

    return NextResponse.json({
      ok: hasSent || simulated,
      sent,
      simulated,
      subscriptions: subscriptions.length,
      expiredRemoved,
      failed,
      error: firstError,
      notificationHistoryError,
      payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sent: 0,
        simulated: false,
        subscriptions: 0,
        expiredRemoved: 0,
        failed: 0,
        error: formatRouteError(error),
      },
      { status: 500 },
    );
  }
}

function formatRouteError(error: unknown) {
  return error instanceof Error ? error.message : "Could not send test notification.";
}
