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
  await Promise.all(
    subscriptions.map((subscription, index) => {
      if (!results[index]?.expired) return Promise.resolve();
      return removePushSubscription(supabase, user.id, subscription.endpoint);
    }),
  );

  const hasSent = results.some((result) => result.ok);
  const simulated = subscriptions.length === 0 || results.some((result) => result.simulated);
  const firstError = results.find((result) => result.error)?.error ?? null;

  await addNotification(supabase, user.id, {
    alertId: null,
    symbol: stock.symbol,
    title: payload.title,
    body: payload.body,
    targetPrice: stock.price,
    triggerPrice: stock.price,
    deliveryStatus: hasSent ? "sent" : simulated ? "simulated" : "failed",
    errorMessage: hasSent || simulated ? null : firstError,
  });

  return NextResponse.json({
    ok: hasSent || simulated,
    sent: results.filter((result) => result.ok).length,
    simulated,
    subscriptions: subscriptions.length,
    payload,
  });
}
