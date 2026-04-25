import {
  type StockHistoryPoint,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
} from "@/lib/types/notistock";

const DEMO_STOCKS: Array<StockSearchResult & { base: number; trend: number }> = [
  { symbol: "AAPL", name: "Apple Inc.", market: "NASDAQ", base: 214.68, trend: 1.2 },
  { symbol: "NVDA", name: "NVIDIA Corporation", market: "NASDAQ", base: 875.4, trend: 2.1 },
  { symbol: "TSLA", name: "Tesla, Inc.", market: "NASDAQ", base: 183.27, trend: -0.8 },
  { symbol: "MSFT", name: "Microsoft Corporation", market: "NASDAQ", base: 421.86, trend: 0.7 },
  { symbol: "AMZN", name: "Amazon.com, Inc.", market: "NASDAQ", base: 187.12, trend: 0.5 },
  { symbol: "GOOGL", name: "Alphabet Inc.", market: "NASDAQ", base: 171.92, trend: 0.3 },
  { symbol: "META", name: "Meta Platforms, Inc.", market: "NASDAQ", base: 492.31, trend: 1.4 },
  { symbol: "SHOP", name: "Shopify Inc.", market: "NYSE", base: 74.66, trend: -0.2 },
  { symbol: "RY", name: "Royal Bank of Canada", market: "NYSE", base: 103.24, trend: 0.4 },
];

const RANGE_COUNTS: Record<StockRange, number> = {
  "1D": 79,
  "7D": 112,
  "1M": 120,
  "3M": 90,
  "6M": 126,
  "1Y": 252,
  "3Y": 156,
};

const RANGE_STEP_SECONDS: Record<StockRange, number> = {
  "1D": 5 * 60,
  "7D": 60 * 60,
  "1M": 6 * 60 * 60,
  "3M": 24 * 60 * 60,
  "6M": 24 * 60 * 60,
  "1Y": 24 * 60 * 60,
  "3Y": 7 * 24 * 60 * 60,
};

export function getDemoStockMeta(symbol: string) {
  return (
    DEMO_STOCKS.find((stock) => stock.symbol === symbol.toUpperCase()) ?? {
      symbol: symbol.toUpperCase(),
      name: `${symbol.toUpperCase()} Holdings`,
      market: "NASDAQ",
      base: 98.45,
      trend: 0.6,
    }
  );
}

export function searchDemoStocks(query: string): StockSearchResult[] {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return DEMO_STOCKS.slice(0, 6);

  return DEMO_STOCKS.filter(
    (stock) =>
      stock.symbol.includes(normalized) ||
      stock.name.toUpperCase().includes(normalized),
  ).slice(0, 8);
}

export function getDemoQuote(symbol: string): StockQuote {
  const stock = getDemoStockMeta(symbol);
  const wave = Math.sin(seedFromSymbol(stock.symbol) + Date.now() / 86_400_000);
  const price = stock.base + stock.trend * 4 + wave * (stock.base * 0.015);
  const previousClose = stock.base - stock.trend;
  const change = price - previousClose;

  return {
    symbol: stock.symbol,
    name: stock.name,
    price: roundMoney(price),
    change: roundMoney(change),
    changePercent: roundMoney((change / previousClose) * 100),
    currency: "USD",
    updatedAt: new Date().toISOString(),
    source: "demo",
  };
}

export function getDemoHistory(symbol: string, range: StockRange): StockHistoryPoint[] {
  const stock = getDemoStockMeta(symbol);
  const count = RANGE_COUNTS[range];
  const step = RANGE_STEP_SECONDS[range];
  const now = Math.floor(Date.now() / 1000);
  const seed = seedFromSymbol(stock.symbol);
  const points: StockHistoryPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const progress = index / Math.max(count - 1, 1);
    const macroTrend = stock.trend * progress * stock.base * 0.045;
    const cycle = Math.sin(index / 5 + seed) * stock.base * 0.018;
    const micro = Math.cos(index / 13 + seed / 2) * stock.base * 0.009;
    const value = stock.base + macroTrend + cycle + micro;

    points.push({
      time: now - (count - index - 1) * step,
      value: roundMoney(value),
    });
  }

  return points;
}

function seedFromSymbol(symbol: string) {
  return symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) / 17;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
