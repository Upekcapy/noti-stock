"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import {
  StockLineChart,
  type ChartPointSelection,
} from "@/components/charts/StockLineChart";
import {
  STOCK_RANGES,
  type StockHistoryPoint,
  type StockHistorySource,
  type StockQuote,
  type StockRange,
} from "@/lib/types/notistock";
import { cn, formatCurrency, formatPercent, normalizeSymbol } from "@/lib/utils";

export type StockChartAlertSelection = ChartPointSelection & {
  symbol: string;
};

type StockChartAlertPrompt = {
  question: (symbol: string, formattedPrice: string) => string;
  description: string;
  confirmLabel: string;
};

const defaultAlertPrompt: StockChartAlertPrompt = {
  question: (symbol, formattedPrice) => `Create an alert for ${symbol} at ${formattedPrice}?`,
  description: "The alert form will open with this symbol and target price filled in.",
  confirmLabel: "Yes",
};

export function StockMarketSnapshot({
  symbol,
  onQuoteChange,
  onCreateAlertFromPoint,
  alertPointPrompt = defaultAlertPrompt,
}: {
  symbol: string;
  onQuoteChange?: (quote: StockQuote | null, historySource: StockHistorySource) => void;
  onCreateAlertFromPoint?: (selection: StockChartAlertSelection) => void;
  alertPointPrompt?: StockChartAlertPrompt;
}) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const [range, setRange] = useState<StockRange>("1D");
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [points, setPoints] = useState<StockHistoryPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<ChartPointSelection | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!normalizedSymbol) return;

    setLoading(true);

    const [quoteResponse, historyResponse] = await Promise.all([
      fetch(`/api/stocks/${encodeURIComponent(normalizedSymbol)}/quote`),
      fetch(`/api/stocks/${encodeURIComponent(normalizedSymbol)}/history?range=${range}`),
    ]);
    const quoteData = (await quoteResponse.json()) as { quote?: StockQuote };
    const historyData = (await historyResponse.json()) as {
      points?: StockHistoryPoint[];
      source?: StockHistorySource;
    };
    const nextQuote = quoteData.quote ?? null;
    const nextHistorySource = historyData.source ?? "demo";

    setQuote(nextQuote);
    setPoints(historyData.points ?? []);
    setLoading(false);
    onQuoteChange?.(nextQuote, nextHistorySource);
  }, [normalizedSymbol, onQuoteChange, range]);

  useEffect(() => {
    setQuote(null);
    setPoints([]);
    setSelectedPoint(null);
    setLoading(true);
  }, [normalizedSymbol]);

  useEffect(() => {
    setSelectedPoint(null);
    void refresh();
  }, [refresh]);

  const positive = (quote?.change ?? 0) >= 0;
  const selectedPointPrice = selectedPoint ? formatCurrency(selectedPoint.price) : "";
  const displayedPoints = useMemo(
    () => alignChartToQuote(points, quote),
    [points, quote],
  );

  if (!normalizedSymbol) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-slate-500">Current price</p>
            <div className="mt-1 flex items-end gap-3">
              <p className="text-4xl font-semibold tracking-tight text-slate-950">
                {quote ? formatCurrency(quote.price) : "-"}
              </p>
              <p
                className={cn(
                  "mb-1 inline-flex items-center gap-1 text-sm font-semibold",
                  positive ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {quote ? formatPercent(quote.changePercent) : "-"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {STOCK_RANGES.map((option) => (
              <button
                key={option}
                className={cn(
                  "h-9 rounded-lg px-3 text-sm font-semibold transition",
                  range === option
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
                type="button"
                onClick={() => setRange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-4">
          {selectedPoint && onCreateAlertFromPoint ? (
            <div className="mb-3 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-950 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">
                  {alertPointPrompt.question(normalizedSymbol, selectedPointPrice)}
                </p>
                <p className="mt-1 text-rose-700">
                  {alertPointPrompt.description}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  type="button"
                  onClick={() => setSelectedPoint(null)}
                >
                  Cancel
                </button>
                <button
                  className="h-9 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                  type="button"
                  onClick={() => {
                    setSelectedPoint(null);
                    onCreateAlertFromPoint({
                      ...selectedPoint,
                      symbol: normalizedSymbol,
                    });
                  }}
                >
                  {alertPointPrompt.confirmLabel}
                </button>
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : null}
          {displayedPoints.length > 0 ? (
            <StockLineChart
              points={displayedPoints}
              selectedPoint={selectedPoint}
              onPointSelect={onCreateAlertFromPoint ? setSelectedPoint : undefined}
            />
          ) : (
            <div className="grid h-[360px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
              <div>
                <TriangleAlert className="mx-auto h-6 w-6 text-amber-500" />
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  Historical chart data is unavailable for this symbol.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Live quotes and alert checks are still using Finnhub.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {quote?.details ? <StockDetailsGrid quote={quote} /> : null}
    </div>
  );
}

function StockDetailsGrid({ quote }: { quote: StockQuote }) {
  const details = quote.details;
  if (!details) return null;

  const rows = [
    ["Open", formatOptionalCurrency(details.open)],
    ["Prev. close", formatOptionalCurrency(details.previousClose)],
    ["Bid", formatOptionalCurrency(details.bid)],
    ["Ask", formatOptionalCurrency(details.ask)],
    ["Day low", formatOptionalCurrency(details.dayLow)],
    ["Day high", formatOptionalCurrency(details.dayHigh)],
    ["52 week low", formatOptionalCurrency(details.week52Low)],
    ["52 week high", formatOptionalCurrency(details.week52High)],
    ["Volume", details.volume ?? "-"],
    ["Market cap", details.marketCap ?? "-"],
    ["Shares", details.sharesOutstanding ?? "-"],
    ["P/E ratio", formatOptionalNumber(details.peRatio)],
    ["EPS", formatOptionalCurrency(details.eps)],
    ["Dividend", formatOptionalCurrency(details.dividend)],
    [
      "Dividend yield",
      details.dividendYield === undefined ? "-" : `${details.dividendYield.toFixed(2)}%`,
    ],
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Market data details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatOptionalCurrency(value: number | undefined) {
  return value === undefined ? "-" : formatCurrency(value);
}

function formatOptionalNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toFixed(2);
}

function alignChartToQuote(
  points: StockHistoryPoint[],
  quote: StockQuote | null,
): StockHistoryPoint[] {
  if (!quote || points.length === 0 || !Number.isFinite(quote.price)) return points;

  const lastPoint = points[points.length - 1];
  if (!lastPoint) return points;
  if (lastPoint.value === quote.price) return points;

  const quoteTime = getQuoteUnixTime(quote);
  const quotePoint = {
    time: quoteTime && quoteTime > lastPoint.time ? quoteTime : lastPoint.time,
    value: quote.price,
  };

  return [...points.slice(0, -1), quotePoint];
}

function getQuoteUnixTime(quote: StockQuote) {
  const parsed = new Date(quote.updatedAt).getTime();
  if (!Number.isFinite(parsed)) return null;

  return Math.floor(parsed / 1000);
}
