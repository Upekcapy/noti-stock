import type { StockHistoryPoint, StockRange } from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

const NASDAQ_API_BASE_URL = "https://api.nasdaq.com/api";
const NASDAQ_REVALIDATE_SECONDS = 15 * 60;
const NASDAQ_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; NotiStock/1.0; stock chart display)",
};

type NasdaqChartResponse = {
  data?: {
    chart?: NasdaqChartPoint[];
  };
};

type NasdaqChartPoint = {
  x?: number;
  y?: number;
};

type NasdaqHistoricalResponse = {
  data?: {
    tradesTable?: {
      rows?: NasdaqHistoricalRow[];
    };
  };
};

type NasdaqHistoricalRow = {
  date?: string;
  close?: string;
};

export async function getNasdaqHistory(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryPoint[]> {
  const symbol = normalizeSymbol(symbolInput);
  if (!symbol) return [];

  if (range === "1D") {
    return getNasdaqIntradayHistory(symbol);
  }

  return getNasdaqDailyHistory(symbol, range);
}

async function getNasdaqIntradayHistory(symbol: string) {
  const data = await fetchNasdaq<NasdaqChartResponse>(
    `/quote/${encodeURIComponent(symbol)}/chart`,
    { assetclass: "stocks" },
  );

  const points = (data?.data?.chart ?? [])
    .map((point) => {
      const time = Number(point.x);
      const value = Number(point.y);
      if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) return null;

      return {
        time: Math.floor(time / 1000),
        value: roundMoney(value),
      };
    })
    .filter((point): point is StockHistoryPoint => Boolean(point));

  return dedupeAndSortPoints(points);
}

async function getNasdaqDailyHistory(symbol: string, range: StockRange) {
  const { from, to } = getDateRange(range);
  const data = await fetchNasdaq<NasdaqHistoricalResponse>(
    `/quote/${encodeURIComponent(symbol)}/historical`,
    {
      assetclass: "stocks",
      fromdate: formatDate(from),
      todate: formatDate(to),
      limit: 9999,
    },
  );

  const points = (data?.data?.tradesTable?.rows ?? [])
    .map((row) => {
      const time = parseNasdaqDate(row.date);
      const value = parseCurrencyNumber(row.close);
      if (!time || value === undefined) return null;

      return {
        time,
        value: roundMoney(value),
      };
    })
    .filter((point): point is StockHistoryPoint => Boolean(point));

  return dedupeAndSortPoints(points);
}

async function fetchNasdaq<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  const url = new URL(`${NASDAQ_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      headers: NASDAQ_HEADERS,
      next: { revalidate: NASDAQ_REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getDateRange(range: StockRange) {
  const to = new Date();
  const from = new Date(to);

  if (range === "7D") from.setDate(from.getDate() - 14);
  if (range === "1M") from.setMonth(from.getMonth() - 1);
  if (range === "3M") from.setMonth(from.getMonth() - 3);
  if (range === "6M") from.setMonth(from.getMonth() - 6);
  if (range === "1Y") from.setFullYear(from.getFullYear() - 1);
  if (range === "3Y") from.setFullYear(from.getFullYear() - 3);

  return { from, to };
}

function parseNasdaqDate(value: string | undefined) {
  if (!value) return null;

  const parsed = new Date(`${value} 16:00:00 GMT-0400`);
  if (Number.isNaN(parsed.getTime())) return null;

  return Math.floor(parsed.getTime() / 1000);
}

function parseCurrencyNumber(value: string | undefined) {
  if (!value) return undefined;

  const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dedupeAndSortPoints(points: StockHistoryPoint[]) {
  const deduped = new Map<number, StockHistoryPoint>();
  for (const point of points) {
    deduped.set(point.time, point);
  }

  return Array.from(deduped.values()).sort((a, b) => a.time - b.time);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
