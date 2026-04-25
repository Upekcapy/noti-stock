import { env, isPolygonConfigured } from "@/lib/env";
import { getDemoHistory, getDemoQuote, searchDemoStocks } from "@/lib/demo-data";
import {
  STOCK_RANGES,
  type StockHistoryPoint,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
} from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

const POLYGON_BASE_URL = "https://api.polygon.io";

type PolygonTicker = {
  ticker: string;
  name: string;
  market?: string;
};

type PolygonAgg = {
  c: number;
  o: number;
  t: number;
};

type RangeConfig = {
  amount: number;
  unit: "day" | "month" | "year";
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week";
};

const RANGE_CONFIG: Record<StockRange, RangeConfig> = {
  "1D": { amount: 1, unit: "day", multiplier: 5, timespan: "minute" },
  "7D": { amount: 7, unit: "day", multiplier: 30, timespan: "minute" },
  "1M": { amount: 1, unit: "month", multiplier: 1, timespan: "hour" },
  "3M": { amount: 3, unit: "month", multiplier: 1, timespan: "day" },
  "6M": { amount: 6, unit: "month", multiplier: 1, timespan: "day" },
  "1Y": { amount: 1, unit: "year", multiplier: 1, timespan: "day" },
  "3Y": { amount: 3, unit: "year", multiplier: 1, timespan: "week" },
};

export function parseStockRange(range: string | null): StockRange {
  return STOCK_RANGES.includes(range as StockRange) ? (range as StockRange) : "1D";
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const normalized = query.trim();
  if (!isPolygonConfigured) return searchDemoStocks(normalized);

  try {
    const url = new URL("/v3/reference/tickers", POLYGON_BASE_URL);
    url.searchParams.set("search", normalized);
    url.searchParams.set("market", "stocks");
    url.searchParams.set("active", "true");
    url.searchParams.set("limit", "10");
    url.searchParams.set("apiKey", env.polygonApiKey);

    const data = await fetchJson<{ results?: PolygonTicker[] }>(url);

    return (
      data.results?.map((ticker) => ({
        symbol: ticker.ticker,
        name: ticker.name,
        market: ticker.market?.toUpperCase(),
      })) ?? searchDemoStocks(normalized)
    );
  } catch {
    return searchDemoStocks(normalized);
  }
}

export async function getStockQuote(symbolInput: string): Promise<StockQuote> {
  const symbol = normalizeSymbol(symbolInput);
  if (!isPolygonConfigured) return getDemoQuote(symbol);

  try {
    const lastTradeUrl = new URL(`/v2/last/trade/${symbol}`, POLYGON_BASE_URL);
    lastTradeUrl.searchParams.set("apiKey", env.polygonApiKey);

    const previousCloseUrl = new URL(`/v2/aggs/ticker/${symbol}/prev`, POLYGON_BASE_URL);
    previousCloseUrl.searchParams.set("adjusted", "true");
    previousCloseUrl.searchParams.set("apiKey", env.polygonApiKey);

    const [lastTrade, previousClose] = await Promise.allSettled([
      fetchJson<{ results?: { p?: number; t?: number } }>(lastTradeUrl),
      fetchJson<{ results?: PolygonAgg[] }>(previousCloseUrl),
    ]);

    const previous = previousClose.status === "fulfilled" ? previousClose.value.results?.[0] : null;
    const last = lastTrade.status === "fulfilled" ? lastTrade.value.results : null;
    const price = last?.p ?? previous?.c;

    if (!price || !previous) return getDemoQuote(symbol);

    const change = price - previous.c;

    return {
      symbol,
      name: symbol,
      price: roundMoney(price),
      change: roundMoney(change),
      changePercent: roundMoney((change / previous.c) * 100),
      currency: "USD",
      updatedAt: new Date(last?.t ?? Date.now()).toISOString(),
      source: "polygon",
    };
  } catch {
    return getDemoQuote(symbol);
  }
}

export async function getStockHistory(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryPoint[]> {
  const symbol = normalizeSymbol(symbolInput);
  if (!isPolygonConfigured) return getDemoHistory(symbol, range);

  try {
    const config = RANGE_CONFIG[range];
    const to = new Date();
    const from = subtractDate(to, config.amount, config.unit);
    const url = new URL(
      `/v2/aggs/ticker/${symbol}/range/${config.multiplier}/${config.timespan}/${formatDate(from)}/${formatDate(to)}`,
      POLYGON_BASE_URL,
    );

    url.searchParams.set("adjusted", "true");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("limit", "50000");
    url.searchParams.set("apiKey", env.polygonApiKey);

    const data = await fetchJson<{ results?: PolygonAgg[] }>(url);
    const points =
      data.results?.map((point) => ({
        time: Math.floor(point.t / 1000),
        value: point.c,
      })) ?? [];

    return points.length > 1 ? points : getDemoHistory(symbol, range);
  } catch {
    return getDemoHistory(symbol, range);
  }
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Polygon request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function subtractDate(date: Date, amount: number, unit: RangeConfig["unit"]) {
  const next = new Date(date);

  if (unit === "day") next.setDate(next.getDate() - amount);
  if (unit === "month") next.setMonth(next.getMonth() - amount);
  if (unit === "year") next.setFullYear(next.getFullYear() - amount);

  return next;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
