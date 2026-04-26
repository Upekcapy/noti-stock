import { NextResponse } from "next/server";
import {
  addNotification,
  listActiveAlertsForCron,
  listPushSubscriptions,
  markAlertChecked,
  markAlertTriggered,
  removePushSubscription,
} from "@/lib/app-data";
import { env, isWebPushConfigured } from "@/lib/env";
import { sendPushNotification } from "@/lib/notifications";
import { getStockQuote } from "@/lib/stocks";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { StockQuote } from "@/lib/types/notistock";
import { isAboveTarget, isBelowTarget, formatCurrency } from "@/lib/utils";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && !isMarketCheckWindow(new Date())) {
    return NextResponse.json({ checked: 0, triggered: 0, skipped: "market_closed" });
  }

  const supabase = createSupabaseAdminClient();
  const alerts = await listActiveAlertsForCron(supabase);
  let triggered = 0;
  let checked = 0;
  let skippedDemoData = 0;
  const quotesBySymbol = await getQuotesForAlerts(
    Array.from(new Set(alerts.map((alert) => alert.symbol))),
  );

  for (const alert of alerts) {
    const quote = quotesBySymbol.get(alert.symbol);
    if (!quote || quote.source === "demo") {
      skippedDemoData += 1;
      continue;
    }

    checked += 1;
    const crossed =
      alert.direction === "above"
        ? isAboveTarget(quote.price, alert.targetPrice)
        : isBelowTarget(quote.price, alert.targetPrice);

    if (!crossed) {
      await markAlertChecked(supabase, alert, quote.price);
      continue;
    }

    triggered += 1;
    await markAlertTriggered(supabase, alert, quote.price);

    const subscriptions = await listPushSubscriptions(supabase, alert.userId);
    const title = `${alert.symbol} reached ${formatCurrency(alert.targetPrice)}`;
    const body = `${alert.symbol} is now ${formatCurrency(quote.price)}.`;
    const payload = {
      title,
      body,
      symbol: alert.symbol,
      url: `/stocks/${alert.symbol}`,
    };
    const sends = await Promise.all(
      subscriptions.map((subscription) => sendPushNotification(subscription, payload)),
    );
    await Promise.all(
      subscriptions.map((subscription, index) => {
        if (!sends[index]?.expired) return Promise.resolve();
        return removePushSubscription(supabase, alert.userId, subscription.endpoint);
      }),
    );
    const sent = sends.some((result) => result.ok);
    const simulated = !isWebPushConfigured || subscriptions.length === 0;
    const firstError = sends.find((result) => result.error)?.error ?? null;

    await addNotification(supabase, alert.userId, {
      alertId: alert.id,
      symbol: alert.symbol,
      title,
      body,
      targetPrice: alert.targetPrice,
      triggerPrice: quote.price,
      deliveryStatus: sent ? "sent" : simulated ? "simulated" : "failed",
      errorMessage: firstError,
    });
  }

  return NextResponse.json({ checked, triggered, skippedDemoData });
}

async function getQuotesForAlerts(symbols: string[]) {
  const quotes = new Map<string, StockQuote>();

  for (const symbol of symbols) {
    quotes.set(symbol, await getStockQuote(symbol, { includeProfile: false }));
  }

  return quotes;
}

function isMarketCheckWindow(date: Date) {
  const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});

  if (eastern.weekday === "Sat" || eastern.weekday === "Sun") return false;

  const hour = Number(eastern.hour);
  const minute = Number(eastern.minute);
  const totalMinutes = hour * 60 + minute;

  return totalMinutes >= 9 * 60 + 30 && totalMinutes <= 16 * 60 + 5;
}
