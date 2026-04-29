"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellPlus, Check, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  StockMarketSnapshot,
  type StockChartAlertSelection,
} from "@/components/stocks/StockMarketSnapshot";
import { StockSearch } from "@/components/stocks/StockSearch";
import type {
  StockHistorySource,
  StockQuote,
  StockSearchResult,
  WatchlistItem,
} from "@/lib/types/notistock";
import { formatDateTime, getAlertPrefillPath, normalizeSymbol } from "@/lib/utils";

export function SearchClient({
  initialSymbol,
  isDemo = false,
}: {
  initialSymbol: string;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const selectedSymbol = normalizeSymbol(initialSymbol);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [historySource, setHistorySource] = useState<StockHistorySource>("demo");
  const [message, setMessage] = useState("");

  const watchlistSymbols = useMemo(
    () => new Set(watchlist.map((item) => item.symbol)),
    [watchlist],
  );
  const selectedIsAdded = selectedSymbol ? watchlistSymbols.has(selectedSymbol) : false;

  const refreshWatchlist = useCallback(async () => {
    const response = await fetch("/api/watchlist");
    if (!response.ok) return;

    const data = (await response.json()) as { items?: WatchlistItem[] };
    setWatchlist(data.items ?? []);
  }, []);

  useEffect(() => {
    void refreshWatchlist();
  }, [refreshWatchlist]);

  useEffect(() => {
    setQuote(null);
    setHistorySource("demo");
    setMessage("");
  }, [selectedSymbol]);

  const handleQuoteChange = useCallback(
    (nextQuote: StockQuote | null, nextHistorySource: StockHistorySource) => {
      setQuote(nextQuote);
      setHistorySource(nextHistorySource);
    },
    [],
  );

  async function handleAdd(stock: StockSearchResult) {
    const normalizedStock = {
      ...stock,
      symbol: normalizeSymbol(stock.symbol),
    };

    if (!normalizedStock.symbol || watchlistSymbols.has(normalizedStock.symbol)) return;

    setMessage("");

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedStock),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? `Could not add ${normalizedStock.symbol}.`);
      return;
    }

    const data = (await response.json().catch(() => null)) as { item?: WatchlistItem } | null;
    const demoItem = data?.item;
    if (isDemo && demoItem) {
      setWatchlist((current) =>
        current.some((item) => item.symbol === demoItem.symbol)
          ? current
          : [demoItem, ...current],
      );
      setMessage(`${normalizedStock.symbol} was added to your demo watchlist.`);
      return;
    }

    await refreshWatchlist();
    setMessage(`${normalizedStock.symbol} was added to your watchlist.`);
  }

  const handleCreateAlertFromPoint = useCallback(
    (selection: StockChartAlertSelection) => {
      router.push(getAlertPrefillPath(selection.symbol, selection.price));
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-700">NotiStock</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Search
          </h1>
        </div>
        {selectedSymbol ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
            {selectedSymbol}
          </div>
        ) : null}
      </div>

      <StockSearch onAdd={handleAdd} watchlistSymbols={watchlistSymbols} />

      {message ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          {message}
        </p>
      ) : null}

      {selectedSymbol ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-emerald-700">Stock</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                  {selectedSymbol}
                </h2>
                <p className="mt-1 text-slate-500">{quote?.name ?? selectedSymbol}</p>
                {quote ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Source:{" "}
                    {quote.sourceUrl ? (
                      <a
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                        href={quote.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {getSourceName(quote)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="font-semibold">{getSourceName(quote)}</span>
                    )}{" "}
                    updated {formatDateTime(quote.updatedAt)}
                    {quote.source === "finnhub"
                      ? ` | Chart: ${getHistorySourceName(historySource)}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"
                  type="button"
                  onClick={() =>
                    handleAdd({
                      symbol: selectedSymbol,
                      name: quote?.name ?? selectedSymbol,
                    })
                  }
                  disabled={selectedIsAdded}
                >
                  {selectedIsAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {selectedIsAdded ? "Added" : "Watchlist"}
                </button>
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  href={getAlertPrefillPath(selectedSymbol)}
                >
                  <BellPlus className="h-4 w-4" />
                  Alert
                </Link>
              </div>
            </div>
          </section>

          <StockMarketSnapshot
            symbol={selectedSymbol}
            onQuoteChange={handleQuoteChange}
            onCreateAlertFromPoint={handleCreateAlertFromPoint}
          />
        </div>
      ) : null}
    </div>
  );
}

function getSourceName(quote: StockQuote) {
  return quote.source === "finnhub" ? "Finnhub" : "Demo data";
}

function getHistorySourceName(source: StockHistorySource) {
  if (source === "finnhub") return "live candles";
  if (source === "nasdaq") return "Nasdaq";
  if (source === "unavailable") return "unavailable";
  return "demo";
}
