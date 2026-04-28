"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cn,
  formatCurrency,
  formatPercent,
  getStockSearchPath,
  normalizeSymbol,
} from "@/lib/utils";
import type { StockQuote, StockSearchResult } from "@/lib/types/notistock";

type StockSearchResultWithQuote = StockSearchResult & { quote?: StockQuote };

export function StockSearch({
  onAdd,
  watchlistSymbols,
}: {
  onAdd: (stock: StockSearchResult) => Promise<void>;
  watchlistSymbols: Set<string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResultWithQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;

      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setOpen(true);

      try {
        const response = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setResults([]);
          return;
        }

        const data = (await response.json()) as { results?: StockSearchResult[] };
        const searchResults = data.results ?? [];
        const resultsWithQuotes = await Promise.all(
          searchResults.map(async (stock) => ({
            ...stock,
            quote: await fetchSearchQuote(stock.symbol, controller.signal),
          })),
        );

        setResults(resultsWithQuotes);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedQuery) {
      setResults([]);
      setOpen(false);
      return;
    }

    const selectedResult = findBestResult(trimmedQuery, results);
    if (selectedResult) {
      openStock(selectedResult.symbol);
      return;
    }

    setOpen(true);
    setLoading(true);

    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(trimmedQuery)}`);
      if (response.ok) {
        const data = (await response.json()) as { results?: StockSearchResult[] };
        const freshResults = data.results ?? [];
        const bestFreshResult = findBestResult(trimmedQuery, freshResults);
        setResults(freshResults);

        if (bestFreshResult) {
          openStock(bestFreshResult.symbol);
          return;
        }
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }

    const fallbackSymbol = normalizeSymbol(trimmedQuery);
    if (fallbackSymbol) openStock(fallbackSymbol);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    setLoading(false);
  }

  function openStock(symbolInput: string) {
    const symbol = normalizeSymbol(symbolInput);
    if (!symbol) return;

    setOpen(false);
    setQuery(symbol);
    router.push(getStockSearchPath(symbol));
  }

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      ref={containerRef}
    >
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-20 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="AAPL, TSLA, NVDA"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (trimmedQuery) setOpen(true);
            }}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            {query ? (
              <button
                aria-label="Clear stock search"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                type="button"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          type="submit"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {open && (results.length || loading) ? (
        <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {loading && !results.length ? (
            <div className="flex items-center gap-2 p-3 text-sm font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching stocks
            </div>
          ) : null}
          {results.map((stock) => {
            const isAdded = watchlistSymbols.has(stock.symbol);
            const quote = stock.quote;
            const positive = (quote?.change ?? 0) >= 0;

            return (
              <div
                key={stock.symbol}
                className="grid gap-3 p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"
              >
                <Link
                  className="grid min-w-0 gap-3 rounded-md transition hover:bg-slate-50 md:col-span-3 md:grid-cols-[1.2fr_1fr_1fr]"
                  href={getStockSearchPath(stock.symbol)}
                  onClick={() => setOpen(false)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{stock.symbol}</p>
                    <p className="truncate text-sm text-slate-500">{stock.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">Price</p>
                    <p className="text-lg font-semibold text-slate-950">
                      {quote ? formatCurrency(quote.price) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">Change</p>
                    <p
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-semibold",
                        positive ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {positive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {quote ? formatPercent(quote.changePercent) : "-"}
                    </p>
                  </div>
                </Link>
                <button
                  aria-label={
                    isAdded
                      ? `${stock.symbol} already in watchlist`
                      : `Add ${stock.symbol} to watchlist`
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                    isAdded
                      ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50",
                  )}
                  type="button"
                  onClick={() => onAdd(stock)}
                  disabled={isAdded}
                  title={
                    isAdded
                      ? `${stock.symbol} is already in your watchlist`
                      : `Add ${stock.symbol}`
                  }
                >
                  {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isAdded ? "Added" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function findBestResult<T extends StockSearchResult>(query: string, searchResults: T[]) {
  const normalizedQuery = normalizeSymbol(query);
  if (!normalizedQuery) return null;

  return (
    searchResults.find((stock) => normalizeSymbol(stock.symbol) === normalizedQuery) ??
    searchResults.find((stock) => normalizeSymbol(stock.symbol).startsWith(normalizedQuery)) ??
    searchResults[0] ??
    null
  );
}

async function fetchSearchQuote(symbol: string, signal: AbortSignal) {
  try {
    const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/quote`, { signal });
    if (!response.ok) return undefined;

    const data = (await response.json()) as { quote?: StockQuote };
    return data.quote?.source === "finnhub" ? data.quote : undefined;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return undefined;
    return undefined;
  }
}
