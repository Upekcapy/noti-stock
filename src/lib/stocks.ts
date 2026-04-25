import {
  getBusinessInsiderHistory,
  getBusinessInsiderQuote,
  searchBusinessInsiderStocks,
} from "@/lib/business-insider";
import {
  STOCK_RANGES,
  type StockHistoryPoint,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
} from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

export function parseStockRange(range: string | null): StockRange {
  return STOCK_RANGES.includes(range as StockRange) ? (range as StockRange) : "1D";
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  return searchBusinessInsiderStocks(query);
}

export async function getStockQuote(symbolInput: string): Promise<StockQuote> {
  const symbol = normalizeSymbol(symbolInput);
  return getBusinessInsiderQuote(symbol);
}

export async function getStockHistory(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryPoint[]> {
  const symbol = normalizeSymbol(symbolInput);
  return getBusinessInsiderHistory(symbol, range);
}
