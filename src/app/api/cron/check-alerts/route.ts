import { NextResponse } from "next/server";
import { evaluateAlertWithQuote } from "@/lib/alert-evaluator";
import { listActiveAlertsForCron } from "@/lib/app-data";
import { env } from "@/lib/env";
import { getStockQuote } from "@/lib/stocks";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { PriceAlert, StockQuote } from "@/lib/types/notistock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUOTE_CONCURRENCY = 6;
const ALERT_CONCURRENCY = 8;
const CRON_FETCH_TIMEOUT_MS = 6_000;
const CRON_FETCH_RETRY_DELAYS_MS = [300, 900, 1_500];

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  direction: PriceAlert["direction"];
  status: PriceAlert["status"];
  created_at: string;
  updated_at: string;
  triggered_at: string | null;
  last_checked_price: number | null;
};

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
    const alerts = await loadActiveAlertsForCron(supabase);

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

async function loadActiveAlertsForCron(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  try {
    return await listActiveAlertsForCron(supabase);
  } catch (error) {
    console.error("Supabase client alert load failed; trying REST fallback", {
      error: formatError(error),
    });

    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) throw error;
    return listActiveAlertsFromRest();
  }
}

async function listActiveAlertsFromRest(): Promise<PriceAlert[]> {
  const url = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/price_alerts`);
  url.searchParams.set("select", "*");
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("order", "created_at.asc");

  const response = await retryingCronFetch(url, {
    headers: {
      Accept: "application/json",
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Supabase REST alert load failed (${response.status}): ${await readResponseText(response)}`,
    );
  }

  const rows = (await response.json()) as AlertRow[];
  return rows.map(mapAlertRow);
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

const retryingCronFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= CRON_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRON_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(input, {
        ...init,
        cache: init?.cache ?? "no-store",
        signal: controller.signal,
      });

      if (response.status < 500 || attempt === CRON_FETCH_RETRY_DELAYS_MS.length) {
        return response;
      }

      lastError = new Error(`Request returned ${response.status}`);
    } catch (error) {
      lastError = error;

      if (attempt === CRON_FETCH_RETRY_DELAYS_MS.length) throw error;
    } finally {
      clearTimeout(timeout);
    }

    await delay(CRON_FETCH_RETRY_DELAYS_MS[attempt]);
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
};

async function readResponseText(response: Response) {
  return (await response.text().catch(() => "")).slice(0, 500);
}

function mapAlertRow(row: AlertRow): PriceAlert {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    targetPrice: Number(row.target_price),
    direction: row.direction,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    triggeredAt: row.triggered_at,
    lastCheckedPrice: row.last_checked_price === null ? null : Number(row.last_checked_price),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    const cause = formatErrorCause(error.cause);
    return cause ? `${error.message}; cause: ${cause}` : error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }

  return "Unknown error";
}

function formatErrorCause(cause: unknown) {
  if (!cause || typeof cause !== "object") return "";

  const details: string[] = [];
  if ("code" in cause && typeof cause.code === "string") details.push(cause.code);
  if ("message" in cause && typeof cause.message === "string") details.push(cause.message);

  return details.join(" ");
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
