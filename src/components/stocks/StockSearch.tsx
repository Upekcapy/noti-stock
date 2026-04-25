"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import type { StockSearchResult } from "@/lib/types/notistock";

export function StockSearch({
  onAdd,
}: {
  onAdd: (stock: StockSearchResult) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as { results: StockSearchResult[] };

    setResults(data.results ?? []);
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <form className="flex gap-2" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="AAPL, TSLA, NVDA"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          type="submit"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {results.length ? (
        <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((stock) => (
            <div key={stock.symbol} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{stock.symbol}</p>
                <p className="truncate text-sm text-slate-500">{stock.name}</p>
              </div>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={() => onAdd(stock)}
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
