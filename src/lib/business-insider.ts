import { env } from "@/lib/env";
import { getDemoHistory, getDemoQuote, searchDemoStocks } from "@/lib/demo-data";
import {
  type StockDetails,
  type StockHistoryPoint,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
} from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

const BUSINESS_INSIDER_REVALIDATE_SECONDS = 15 * 60;
const USER_AGENT =
  "NotiStock/1.0 (+https://notistock.local; stock alert polling every 15 minutes)";

type BusinessInsiderPriceSection = {
  label?: string;
  symbol?: string;
  currentValue?: number;
  absoluteValue?: number;
  relativeValue?: number;
  previousClose?: number;
  time?: string;
};

type BusinessInsiderChartViewModel = {
  TKData?: string;
  intradayTkData?: string;
  InstrumentType?: string;
};

type BusinessInsiderChartRow = {
  Close?: number;
  Open?: number;
  High?: number;
  Low?: number;
  Volume?: number;
  Date?: string;
};

type DateRange = {
  from: Date;
  to: Date;
};

export async function searchBusinessInsiderStocks(
  query: string,
): Promise<StockSearchResult[]> {
  const normalized = normalizeSymbol(query);
  if (!normalized) return searchDemoStocks(query);

  const scraped = await scrapeBusinessInsiderQuote(normalized);
  if (!scraped || scraped.source === "demo") {
    return searchDemoStocks(query);
  }

  return [
    {
      symbol: scraped.symbol,
      name: scraped.name,
      market: "Markets Insider",
    },
  ];
}

export async function getBusinessInsiderQuote(symbolInput: string): Promise<StockQuote> {
  const symbol = normalizeSymbol(symbolInput);
  const scraped = await scrapeBusinessInsiderQuote(symbol);

  return scraped ?? getDemoQuote(symbol);
}

export async function getBusinessInsiderHistory(
  symbolInput: string,
  range: StockRange,
): Promise<StockHistoryPoint[]> {
  const symbol = normalizeSymbol(symbolInput);
  const html = await fetchBusinessInsiderHtml(symbol);
  if (!html) return getDemoHistory(symbol, range);

  const chartViewModel = extractChartViewModel(html);
  if (!chartViewModel?.TKData || !chartViewModel.InstrumentType) {
    return getDemoHistory(symbol, range);
  }

  const points = await fetchBusinessInsiderChartData(chartViewModel, range);

  return points.length > 1 ? points : getDemoHistory(symbol, range);
}

async function scrapeBusinessInsiderQuote(symbol: string): Promise<StockQuote | null> {
  const html = await fetchBusinessInsiderHtml(symbol);
  if (!html) return null;

  const url = getBusinessInsiderStockUrl(symbol);
  const priceSection = extractPriceSection(html);

  if (!priceSection?.currentValue || !priceSection.symbol) return null;

  const details = extractSnapshotDetails(html);
  const timestamp = parseBusinessInsiderTime(priceSection.time);
  const previousClose = details.previousClose ?? priceSection.previousClose;
  const change =
    priceSection.absoluteValue ??
    (previousClose ? priceSection.currentValue - previousClose : 0);
  const changePercent =
    priceSection.relativeValue ??
    (previousClose ? (change / previousClose) * 100 : 0);

  return {
    symbol: normalizeSymbol(priceSection.symbol),
    name: priceSection.label?.trim() || priceSection.symbol,
    price: roundMoney(priceSection.currentValue),
    change: roundMoney(change),
    changePercent: roundMoney(changePercent),
    currency: "USD",
    updatedAt: timestamp.toISOString(),
    source: "business-insider",
    sourceUrl: url.toString(),
    details: {
      ...details,
      previousClose,
    },
  };
}

async function fetchBusinessInsiderHtml(symbol: string) {
  const url = getBusinessInsiderStockUrl(symbol);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: BUSINESS_INSIDER_REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function getBusinessInsiderStockUrl(symbol: string) {
  return new URL(`/stocks/${symbol.toLowerCase()}-stock`, env.businessInsiderBaseUrl);
}

function extractPriceSection(html: string): BusinessInsiderPriceSection | null {
  const match = html.match(/priceSection:\s*(\{[\s\S]*?\})\s*\n\s*\}/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]) as BusinessInsiderPriceSection;
  } catch {
    return null;
  }
}

function extractChartViewModel(html: string): BusinessInsiderChartViewModel | null {
  const match = html.match(/var detailChartViewmodel = (\{[\s\S]*?\});/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]) as BusinessInsiderChartViewModel;
  } catch {
    return null;
  }
}

async function fetchBusinessInsiderChartData(
  viewModel: BusinessInsiderChartViewModel,
  range: StockRange,
) {
  const rangeDates = getDateRange(range);
  const url = new URL("/Ajax/Chart_GetChartData", env.businessInsiderBaseUrl);

  url.searchParams.set("instrumentType", viewModel.InstrumentType ?? "Share");
  url.searchParams.set("tkData", viewModel.TKData ?? "");
  url.searchParams.set("from", formatBusinessInsiderDate(rangeDates.from));
  url.searchParams.set("to", formatBusinessInsiderDate(rangeDates.to));

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,text/plain,*/*",
        Referer: env.businessInsiderBaseUrl,
      },
      next: { revalidate: BUSINESS_INSIDER_REVALIDATE_SECONDS },
    });

    if (!response.ok) return [];

    const rows = (await response.json()) as BusinessInsiderChartRow[];

    return rows
      .map((row) => {
        const time = parseChartDate(row.Date);
        const value = Number(row.Close);

        if (!time || !Number.isFinite(value)) return null;

        return {
          time,
          value: roundMoney(value),
        };
      })
      .filter((point): point is StockHistoryPoint => Boolean(point));
  } catch {
    return [];
  }
}

function extractSnapshotDetails(html: string): StockDetails {
  const details: StockDetails = {};
  const itemRegex =
    /<div class="snapshot__data-item[^"]*">\s*([\s\S]*?)\s*<div class="snapshot__header">([\s\S]*?)<\/div>\s*<\/div>/g;

  for (const match of html.matchAll(itemRegex)) {
    const value = cleanHtml(match[1] ?? "");
    const label = cleanHtml(match[2] ?? "").toLowerCase();

    if (!value || !label) continue;

    if (label === "bid") details.bid = parseNumber(value);
    if (label === "ask") details.ask = parseNumber(value);
    if (label === "prev. close") details.previousClose = parseNumber(value);
    if (label === "open") details.open = parseNumber(value);
    if (label === "volume") details.volume = value;
    if (label.startsWith("market cap")) details.marketCap = value;
    if (label === "number of shares" || label === "total number of shares") {
      details.sharesOutstanding = value;
    }
    if (label === "day low") details.dayLow = parseNumber(value);
    if (label === "day high") details.dayHigh = parseNumber(value);
    if (label === "52 week low") details.week52Low = parseNumber(value);
    if (label === "52 week high") details.week52High = parseNumber(value);
    if (label === "dividend in usd") details.dividend = parseNumber(value);
    if (label === "dividend yield") details.dividendYield = parseNumber(value);
    if (label === "p/e ratio") details.peRatio = parseNumber(value);
    if (label === "eps in usd") details.eps = parseNumber(value);
  }

  return details;
}

function getDateRange(range: StockRange): DateRange {
  const to = new Date();
  const from = new Date(to);

  if (range === "1D") from.setDate(from.getDate() - 1);
  if (range === "7D") from.setDate(from.getDate() - 7);
  if (range === "1M") from.setMonth(from.getMonth() - 1);
  if (range === "3M") from.setMonth(from.getMonth() - 3);
  if (range === "6M") from.setMonth(from.getMonth() - 6);
  if (range === "1Y") from.setFullYear(from.getFullYear() - 1);
  if (range === "3Y") from.setFullYear(from.getFullYear() - 3);

  return { from, to };
}

function formatBusinessInsiderDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}${month}${day}`;
}

function parseChartDate(value: string | undefined) {
  if (!value) return null;

  const parsed = new Date(`${value} GMT-0400`);
  if (Number.isNaN(parsed.getTime())) return null;

  return Math.floor(parsed.getTime() / 1000);
}

function parseBusinessInsiderTime(time: string | undefined) {
  if (!time) return new Date();

  const normalized = time.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /(\d{1,2}:\d{2}:\d{2})\s(AM|PM)\sEDT\s(\d{1,2}\/\d{1,2}\/\d{4})/i,
  );

  if (!match) return new Date();

  const parsed = new Date(`${match[3]} ${match[1]} ${match[2]} GMT-0400`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function cleanHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  const normalized = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
  const number = Number.parseFloat(normalized);

  return Number.isFinite(number) ? number : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
