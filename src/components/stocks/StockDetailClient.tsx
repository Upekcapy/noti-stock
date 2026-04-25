"use client";

import { useCallback, useEffect, useState } from "react";
import { BellPlus, Loader2, Plus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { StockLineChart } from "@/components/charts/StockLineChart";
import {
  STOCK_RANGES,
  type StockHistoryPoint,
  type StockQuote,
  type StockRange,
} from "@/lib/types/notistock";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

export function StockDetailClient({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<StockRange>("1D");
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [points, setPoints] = useState<StockHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    const [quoteResponse, historyResponse] = await Promise.all([
      fetch(`/api/stocks/${symbol}/quote`),
      fetch(`/api/stocks/${symbol}/history?range=${range}`),
    ]);
    const quoteData = (await quoteResponse.json()) as { quote: StockQuote };
    const historyData = (await historyResponse.json()) as { points: StockHistoryPoint[] };

    setQuote(quoteData.quote);
    setPoints(historyData.points ?? []);
    setLoading(false);
  }, [range, symbol]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addToWatchlist() {
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, name: quote?.name ?? symbol }),
    });
  }

  const positive = (quote?.change ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-700">Stock</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            {symbol}
          </h1>
          <p className="mt-1 text-slate-500">{quote?.name ?? symbol}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={addToWatchlist}
          >
            <Plus className="h-4 w-4" />
            Watchlist
          </button>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            href={`/alerts?symbol=${symbol}`}
          >
            <BellPlus className="h-4 w-4" />
            Alert
          </Link>
        </div>
      </div>

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
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : null}
          <StockLineChart points={points} />
        </div>
      </section>
    </div>
  );
}
