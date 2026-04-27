"use client";

import { useCallback, useState } from "react";
import {
  BellPlus,
  ExternalLink,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { StockMarketSnapshot } from "@/components/stocks/StockMarketSnapshot";
import {
  type StockHistorySource,
  type StockQuote,
} from "@/lib/types/notistock";
import { formatDateTime } from "@/lib/utils";

export function StockDetailClient({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [historySource, setHistorySource] = useState<StockHistorySource>("demo");

  const handleQuoteChange = useCallback(
    (nextQuote: StockQuote | null, nextHistorySource: StockHistorySource) => {
      setQuote(nextQuote);
      setHistorySource(nextHistorySource);
    },
    [],
  );

  async function addToWatchlist() {
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, name: quote?.name ?? symbol }),
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-700">Stock</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            {symbol}
          </h1>
          <p className="mt-1 text-slate-500">{quote?.name ?? symbol}</p>
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
              {quote.source === "finnhub" ? ` | Chart: ${getHistorySourceName(historySource)}` : ""}
            </p>
          ) : null}
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

      <StockMarketSnapshot symbol={symbol} onQuoteChange={handleQuoteChange} />
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

