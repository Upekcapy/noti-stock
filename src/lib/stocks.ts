import { getDemoHistory, getDemoQuote, searchDemoStocks } from "@/lib/demo-data";
import {
  getFinnhubHistory,
  getFinnhubQuote,
  searchFinnhubStocks,
  type FinnhubQuoteOptions,
} from "@/lib/finnhub";
import { getNasdaqHistory } from "@/lib/nasdaq";
import {
  STOCK_RANGES,
  type StockHistoryPoint,
  type StockHistoryResult,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
} from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

export function parseStockRange(range: string | null): StockRange {
  return STOCK_RANGES.includes(range as StockRange) ? (range as StockRange) : "1D";
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const results = await searchFinnhubStocks(query);
  return results.length > 0 ? results : searchDemoStocks(query);
}

export async function getStockQuote(
  symbolInput: string,
  options?: FinnhubQuoteOptions,
): Promise<StockQuote> {
  const symbol = normalizeSymbol(symbolInput);
  return (await getFinnhubQuote(symbol, options)) ?? getDemoQuote(symbol);
}

export async function getStockHistory(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryPoint[]> {
  return (await getStockHistoryResult(symbolInput, range)).points;
}

export async function getStockHistoryResult(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryResult> {
  const symbol = normalizeSymbol(symbolInput);
  const points = await getFinnhubHistory(symbol, range);
  if (points.length > 0) {
    return { points, source: "finnhub" };
  }

  const nasdaqPoints = await getNasdaqHistory(symbol, range);
  if (nasdaqPoints.length > 0) {
    return { points: nasdaqPoints, source: "nasdaq" };
  }

  const quote = await getFinnhubQuote(symbol, { includeProfile: false });
  if (quote) {
    return { points: [], source: "unavailable" };
  }

  return { points: getDemoHistory(symbol, range), source: "demo" };
}
