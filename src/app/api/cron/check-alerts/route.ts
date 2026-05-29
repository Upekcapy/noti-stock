import { NextResponse } from "next/server";
import { evaluateAlertWithQuote } from "@/lib/alert-evaluator";
import { listActiveAlertsForCron } from "@/lib/app-data";
import { env } from "@/lib/env";
import { getStockQuote } from "@/lib/stocks";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { StockQuote } from "@/lib/types/notistock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUOTE_CONCURRENCY = 6;
const ALERT_CONCURRENCY = 8;

type QuoteFetchFailure = {
  symbol: string;
  error: string;
};

type AlertCheckFailure = {
  alertId: string;
  symbol: string;
  error: string;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let phase = "start";

  try {
    phase = "parse request";
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";

    phase = "check market window";
    if (!force && !isMarketCheckWindow(new Date())) {
      return NextResponse.json({ checked: 0, triggered: 0, skipped: "market_closed" });
    }

    phase = "create Supabase admin client";
    const supabase = createSupabaseAdminClient();

    phase = "load active alerts";
    const alerts = await listActiveAlertsForCron(supabase);

    phase = "fetch stock quotes";
    const symbols = Array.from(new Set(alerts.map((alert) => alert.symbol)));
    const { quoteFailures, quotesBySymbol } = await getQuotesForAlerts(symbols);

    phase = "evaluate alerts";
    const alertResults = await mapWithConcurrency(
      alerts,
      ALERT_CONCURRENCY,
      async (alert) => {
        try {
          const result = await evaluateAlertWithQuote(
            supabase,
            alert,
            quotesBySymbol.get(alert.symbol) ?? null,
          );

          return { alert, result, failure: null };
        } catch (error) {
          const failure = {
            alertId: alert.id,
            symbol: alert.symbol,
            error: formatError(error),
          };

          console.error("Alert evaluation failed during cron check", failure);
          return { alert, result: null, failure };
        }
      },
    );

    let triggered = 0;
    let checked = 0;
    let skippedDemoData = 0;
    const alertFailures: AlertCheckFailure[] = [];

    for (const item of alertResults) {
      if (item.failure) {
        alertFailures.push(item.failure);
        continue;
      }

      if (item.result?.skippedDemoData) skippedDemoData += 1;
      if (item.result?.checked) checked += 1;
      if (item.result?.triggered) triggered += 1;
    }

    return NextResponse.json({
      alerts: alerts.length,
      symbols: symbols.length,
      checked,
      triggered,
      skippedDemoData,
      quoteFailures: quoteFailures.length,
      alertFailures: alertFailures.length,
      failures: [...quoteFailures, ...alertFailures].slice(0, 10),
    });
  } catch (error) {
    console.error("Cron alert check failed", { phase, error });
    return NextResponse.json(
      { error: "Alert check failed", phase, detail: formatError(error) },
      { status: 500 },
    );
  }
}

async function getQuotesForAlerts(symbols: string[]) {
  const quotes = new Map<string, StockQuote>();
  const quoteFailures: QuoteFetchFailure[] = [];
  const results = await mapWithConcurrency(symbols, QUOTE_CONCURRENCY, async (symbol) => {
    try {
      return {
        symbol,
        quote: await getStockQuote(symbol, { includeProfile: false }),
        error: null,
      };
    } catch (error) {
      const failure = { symbol, error: formatError(error) };
      console.error("Quote fetch failed during cron check", failure);
      return { symbol, quote: null, error: failure.error };
    }
  });

  for (const result of results) {
    if (result.quote) quotes.set(result.symbol, result.quote);
    if (result.error) quoteFailures.push({ symbol: result.symbol, error: result.error });
  }

  return { quoteFailures, quotesBySymbol: quotes };
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
) {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }

  return "Unknown error";
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
