import { NextResponse } from "next/server";
import { evaluateAlertWithQuote } from "@/lib/alert-evaluator";
import { listActiveAlertsForCron } from "@/lib/app-data";
import { env } from "@/lib/env";
import { getStockQuote } from "@/lib/stocks";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { StockQuote } from "@/lib/types/notistock";

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
    const result = await evaluateAlertWithQuote(
      supabase,
      alert,
      quotesBySymbol.get(alert.symbol) ?? null,
    );

    if (result.skippedDemoData) {
      skippedDemoData += 1;
      continue;
    }

    if (result.checked) checked += 1;
    if (result.triggered) triggered += 1;
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
