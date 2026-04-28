"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StockSearchResult } from "@/lib/types/notistock";
import { getStockSearchPath, normalizeSymbol } from "@/lib/utils";

export function HeaderStockSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
        setResults(data.results ?? []);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const symbol = normalizeSymbol(results[0]?.symbol ?? trimmedQuery);
    if (!symbol) return;

    setOpen(false);
    router.push(getStockSearchPath(symbol));
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setOpen(false);
    setLoading(false);
  }

  return (
    <div className="relative hidden w-full max-w-md md:block" ref={containerRef}>
      <form
        className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100"
        onSubmit={handleSubmit}
      >
        <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
        <input
          className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
          placeholder="Search ticker"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (trimmedQuery) setOpen(true);
          }}
        />
        <div className="flex items-center gap-1 pr-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          {query ? (
            <button
              aria-label="Clear header stock search"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              type="button"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            className="inline-flex h-8 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!normalizeSymbol(trimmedQuery)}
          >
            Search
          </button>
        </div>
      </form>

      {open && (results.length || loading) ? (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && !results.length ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching stocks
            </div>
          ) : null}
          {results.map((stock) => (
            <Link
              key={stock.symbol}
              className="block border-b border-slate-100 px-3 py-3 last:border-b-0 hover:bg-slate-50"
              href={getStockSearchPath(stock.symbol)}
              onClick={() => {
                setOpen(false);
                setQuery(stock.symbol);
              }}
            >
              <p className="text-sm font-semibold text-slate-950">{stock.symbol}</p>
              <p className="truncate text-xs font-medium text-slate-500">{stock.name}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
