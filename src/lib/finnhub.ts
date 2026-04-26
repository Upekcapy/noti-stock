import { env, isFinnhubConfigured } from "@/lib/env";
import {
  type StockHistoryPoint,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
} from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

const FINNHUB_API_BASE_URL = "https://finnhub.io/api/v1";
const FINNHUB_SOURCE_URL = "https://finnhub.io/";
const QUOTE_REVALIDATE_SECONDS = 60;
const SEARCH_REVALIDATE_SECONDS = 5 * 60;
const PROFILE_REVALIDATE_SECONDS = 24 * 60 * 60;
const HISTORY_REVALIDATE_SECONDS = 15 * 60;
const USER_AGENT =
  "NotiStock/1.0 (+https://notistock.local; stock alert polling every 15 minutes)";

type FinnhubSearchResponse = {
  result?: FinnhubSearchItem[];
};

type FinnhubSearchItem = {
  description?: string;
  displaySymbol?: string;
  symbol?: string;
  type?: string;
};

type FinnhubQuoteResponse = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

type FinnhubProfileResponse = {
  currency?: string;
  exchange?: string;
  marketCapitalization?: number;
  name?: string;
  shareOutstanding?: number;
  ticker?: string;
};

type FinnhubCandleResponse = {
  c?: number[];
  s?: string;
  t?: number[];
};

export type FinnhubQuoteOptions = {
  includeProfile?: boolean;
};

export async function searchFinnhubStocks(query: string): Promise<StockSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || !isFinnhubConfigured) return [];

  const data = await fetchFinnhub<FinnhubSearchResponse>(
    "/search",
    { q: normalizedQuery },
    SEARCH_REVALIDATE_SECONDS,
  );

  const seen = new Set<string>();
  const exactQuery = normalizeSymbol(normalizedQuery);

  return (data?.result ?? [])
    .map((item) => mapSearchItem(item))
    .filter((item): item is StockSearchResult => Boolean(item))
    .sort((left, right) => {
      if (left.symbol === exactQuery) return -1;
      if (right.symbol === exactQuery) return 1;
      return scoreSearchResult(right) - scoreSearchResult(left);
    })
    .filter((item) => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    })
    .slice(0, 16);
}

export async function getFinnhubQuote(
  symbolInput: string,
  options: FinnhubQuoteOptions = {},
): Promise<StockQuote | null> {
  const symbol = normalizeSymbol(symbolInput);
  if (!symbol || !isFinnhubConfigured) return null;

  const [quote, profile] = await Promise.all([
    fetchFinnhub<FinnhubQuoteResponse>(
      "/quote",
      { symbol },
      QUOTE_REVALIDATE_SECONDS,
    ),
    options.includeProfile === false
      ? Promise.resolve(null)
      : fetchFinnhub<FinnhubProfileResponse>(
          "/stock/profile2",
          { symbol },
          PROFILE_REVALIDATE_SECONDS,
        ),
  ]);

  if (!quote || !isFinitePositiveNumber(quote.c)) return null;

  const price = quote.c;
  const previousClose = isFinitePositiveNumber(quote.pc) ? quote.pc : undefined;
  const change = isFiniteNumber(quote.d)
    ? quote.d
    : previousClose
      ? price - previousClose
      : 0;
  const changePercent = isFiniteNumber(quote.dp)
    ? quote.dp
    : previousClose
      ? (change / previousClose) * 100
      : 0;
  const updatedAt =
    isFinitePositiveNumber(quote.t) && quote.t > 0
      ? new Date(quote.t * 1000)
      : new Date();

  return {
    symbol,
    name: profile?.name?.trim() || symbol,
    price: roundMoney(price),
    change: roundMoney(change),
    changePercent: roundMoney(changePercent),
    currency: profile?.currency?.trim() || "USD",
    updatedAt: updatedAt.toISOString(),
    source: "finnhub",
    sourceUrl: FINNHUB_SOURCE_URL,
    details: {
      open: isFinitePositiveNumber(quote.o) ? roundMoney(quote.o) : undefined,
      previousClose: previousClose === undefined ? undefined : roundMoney(previousClose),
      dayLow: isFinitePositiveNumber(quote.l) ? roundMoney(quote.l) : undefined,
      dayHigh: isFinitePositiveNumber(quote.h) ? roundMoney(quote.h) : undefined,
      marketCap: formatMillionsAsCompactCurrency(profile?.marketCapitalization),
      sharesOutstanding: formatMillionsAsCompactNumber(profile?.shareOutstanding),
    },
  };
}

export async function getFinnhubHistory(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryPoint[]> {
  const symbol = normalizeSymbol(symbolInput);
  if (!symbol || !isFinnhubConfigured) return [];

  const config = getRangeConfig(range);
  const to = getRoundedUnixTimestamp(config.bucketSeconds);
  const from = to - config.lookbackSeconds;
  const data = await fetchFinnhub<FinnhubCandleResponse>(
    "/stock/candle",
    {
      symbol,
      resolution: config.resolution,
      from,
      to,
    },
    HISTORY_REVALIDATE_SECONDS,
  );

  if (data?.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c)) {
    return [];
  }

  const points = data.t
    .map((time, index) => {
      const value = data.c?.[index];
      if (!isFinitePositiveNumber(time) || !isFinitePositiveNumber(value)) return null;

      return {
        time,
        value: roundMoney(value),
      };
    })
    .filter((point): point is StockHistoryPoint => Boolean(point));

  return points.length > 1 ? points : [];
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string | number>,
  revalidateSeconds: number,
): Promise<T | null> {
  const url = new URL(`${FINNHUB_API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("token", env.finnhubApiKey);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: revalidateSeconds },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mapSearchItem(item: FinnhubSearchItem): StockSearchResult | null {
  const symbol = normalizeProviderSymbol(item.symbol ?? item.displaySymbol ?? "");
  if (!symbol) return null;

  return {
    symbol,
    name: item.description?.trim() || symbol,
    market: item.type?.trim() || "Finnhub",
  };
}

function normalizeProviderSymbol(value: string) {
  const raw = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z.]{0,11}$/.test(raw)) return "";
  return normalizeSymbol(raw);
}

function scoreSearchResult(item: StockSearchResult) {
  let score = 0;
  if (!item.symbol.includes(".")) score += 2;
  if (/common stock/i.test(item.market ?? "")) score += 1;
  return score;
}

function getRangeConfig(range: StockRange) {
  if (range === "1D") {
    return {
      resolution: "5",
      lookbackSeconds: 24 * 60 * 60,
      bucketSeconds: 5 * 60,
    };
  }

  if (range === "7D") {
    return {
      resolution: "60",
      lookbackSeconds: 7 * 24 * 60 * 60,
      bucketSeconds: 60 * 60,
    };
  }

  if (range === "3Y") {
    return {
      resolution: "W",
      lookbackSeconds: 3 * 366 * 24 * 60 * 60,
      bucketSeconds: 24 * 60 * 60,
    };
  }

  const lookbackDays: Record<Exclude<StockRange, "1D" | "7D" | "3Y">, number> = {
    "1M": 31,
    "3M": 93,
    "6M": 186,
    "1Y": 366,
  };

  return {
    resolution: "D",
    lookbackSeconds: lookbackDays[range] * 24 * 60 * 60,
    bucketSeconds: 24 * 60 * 60,
  };
}

function getRoundedUnixTimestamp(bucketSeconds: number) {
  return Math.floor(Date.now() / 1000 / bucketSeconds) * bucketSeconds;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFinitePositiveNumber(value: number | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}

function formatMillionsAsCompactCurrency(value: number | undefined) {
  if (!isFinitePositiveNumber(value)) return undefined;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value * 1_000_000);
}

function formatMillionsAsCompactNumber(value: number | undefined) {
  if (!isFinitePositiveNumber(value)) return undefined;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value * 1_000_000);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
