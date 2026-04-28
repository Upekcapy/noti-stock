import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addNotification,
  listPushSubscriptions,
  markAlertChecked,
  markAlertTriggered,
  removePushSubscription,
} from "@/lib/app-data";
import { isWebPushConfigured } from "@/lib/env";
import { sendPushNotification } from "@/lib/notifications";
import type { PriceAlert, StockQuote } from "@/lib/types/notistock";
import { formatCurrency, getStockSearchPath, isAboveTarget, isBelowTarget } from "@/lib/utils";

export type AlertEvaluationResult = {
  checked: boolean;
  triggered: boolean;
  skippedDemoData: boolean;
};

export async function evaluateAlertWithQuote(
  supabase: SupabaseClient | null,
  alert: PriceAlert,
  quote: StockQuote | null,
): Promise<AlertEvaluationResult> {
  if (!quote || quote.source === "demo") {
    return { checked: false, triggered: false, skippedDemoData: true };
  }

  const crossed =
    alert.direction === "above"
      ? isAboveTarget(quote.price, alert.targetPrice)
      : isBelowTarget(quote.price, alert.targetPrice);

  if (!crossed) {
    await markAlertChecked(supabase, alert, quote.price);
    return { checked: true, triggered: false, skippedDemoData: false };
  }

  await markAlertTriggered(supabase, alert, quote.price);
  await sendAlertNotification(supabase, alert, quote);

  return { checked: true, triggered: true, skippedDemoData: false };
}

async function sendAlertNotification(
  supabase: SupabaseClient | null,
  alert: PriceAlert,
  quote: StockQuote,
) {
  const subscriptions = await listPushSubscriptions(supabase, alert.userId);
  const title = `${alert.symbol} reached ${formatCurrency(alert.targetPrice)}`;
  const body = `${alert.symbol} is now ${formatCurrency(quote.price)}.`;
  const payload = {
    title,
    body,
    symbol: alert.symbol,
    url: getStockSearchPath(alert.symbol),
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
