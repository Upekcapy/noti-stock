"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { StockSearch } from "@/components/stocks/StockSearch";
import type {
  AppUser,
  PriceAlert,
  StockQuote,
  StockSearchResult,
  WatchlistItem,
} from "@/lib/types/notistock";
import { cn, formatCurrency, formatPercent, getStockSearchPath } from "@/lib/utils";

type WatchlistQuote = WatchlistItem & { quote?: StockQuote };
type FeaturedStock = StockSearchResult & {
  rank: number;
  detail: string;
};
type FeaturedStockQuote = FeaturedStock & { quote?: StockQuote };

const LARGEST_STOCKS: FeaturedStock[] = [
  { rank: 1, symbol: "NVDA", name: "NVIDIA Corporation", detail: "Semiconductors / AI", market: "NASDAQ" },
  { rank: 2, symbol: "AAPL", name: "Apple Inc.", detail: "Technology", market: "NASDAQ" },
  { rank: 3, symbol: "GOOGL", name: "Alphabet Inc.", detail: "Technology", market: "NASDAQ" },
  { rank: 4, symbol: "MSFT", name: "Microsoft Corporation", detail: "Technology", market: "NASDAQ" },
  { rank: 5, symbol: "AMZN", name: "Amazon.com, Inc.", detail: "E-commerce / Cloud", market: "NASDAQ" },
  { rank: 6, symbol: "META", name: "Meta Platforms, Inc.", detail: "Technology", market: "NASDAQ" },
  { rank: 7, symbol: "AVGO", name: "Broadcom Inc.", detail: "Semiconductors", market: "NASDAQ" },
  { rank: 8, symbol: "TSM", name: "Taiwan Semiconductor Manufacturing Company", detail: "Semiconductors", market: "NYSE" },
  { rank: 9, symbol: "TSLA", name: "Tesla, Inc.", detail: "Automotive / AI", market: "NASDAQ" },
  { rank: 10, symbol: "2222.SR", name: "Saudi Arabian Oil Co.", detail: "Energy", market: "Tadawul" },
];

const MOST_VOLATILE_STOCKS: FeaturedStock[] = [
  { rank: 1, symbol: "AREB", name: "American Rebel Holdings, Inc.", detail: "Volatility 333.56%", market: "NASDAQ" },
  { rank: 2, symbol: "VIVK", name: "Vivakor, Inc.", detail: "Volatility 327.52%", market: "NASDAQ" },
  { rank: 3, symbol: "CMPX", name: "Compass Therapeutics, Inc.", detail: "Volatility 212.42%", market: "NASDAQ" },
  { rank: 4, symbol: "CHSN", name: "Chanson International Holding", detail: "Volatility 182.62%", market: "NASDAQ" },
  { rank: 5, symbol: "HTCO", name: "High-Trend International Group", detail: "Volatility 164.72%", market: "NASDAQ" },
  { rank: 6, symbol: "POET", name: "POET Technologies Inc.", detail: "Volatility 97.39%", market: "NASDAQ" },
  { rank: 7, symbol: "FGI", name: "FGI Industries Ltd.", detail: "Volatility 97.36%", market: "NASDAQ" },
  { rank: 8, symbol: "CUE", name: "Cue Biopharma, Inc.", detail: "Volatility 93.56%", market: "NASDAQ" },
  { rank: 9, symbol: "TJGC", name: "TJGC Group Limited", detail: "Volatility 89.51%", market: "NASDAQ" },
  { rank: 10, symbol: "MAXN", name: "Maxeon Solar Technologies, Ltd.", detail: "Volatility 86.25%", market: "NASDAQ" },
];

export function DashboardClient({ user }: { user: AppUser }) {
  const [items, setItems] = useState<WatchlistQuote[]>([]);
  const [largestStocks, setLargestStocks] = useState<FeaturedStockQuote[]>(LARGEST_STOCKS);
  const [volatileStocks, setVolatileStocks] =
    useState<FeaturedStockQuote[]>(MOST_VOLATILE_STOCKS);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "active").length,
    [alerts],
  );
  const watchlistSymbols = useMemo(
    () => new Set(items.map((item) => item.symbol)),
    [items],
  );

  const refresh = useCallback(async () => {
    setLoading(true);

    const [watchlistResponse, alertsResponse] = await Promise.all([
      fetch("/api/watchlist"),
      fetch("/api/alerts"),
    ]);
    const watchlistData = (await watchlistResponse.json()) as { items: WatchlistItem[] };
    const alertsData = (await alertsResponse.json()) as { alerts: PriceAlert[] };

    const [quotes, largestQuotes, volatileQuotes] = await Promise.all([
      Promise.all(
        (watchlistData.items ?? []).map(async (item) => ({
          ...item,
          quote: await fetchStockQuote(item.symbol),
        })),
      ),
      loadFeaturedQuotes(LARGEST_STOCKS),
      loadFeaturedQuotes(MOST_VOLATILE_STOCKS),
    ]);

    setItems(quotes);
    setLargestStocks(largestQuotes);
    setVolatileStocks(volatileQuotes);
    setAlerts(alertsData.alerts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(stock: StockSearchResult) {
    setMessage("");

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stock),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? `Could not add ${stock.symbol}.`);
      return;
    }

    await refresh();
    setMessage(`${stock.symbol} was added to your watchlist.`);
  }

  async function handleRemove(symbol: string) {
    setMessage("");

    const response = await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? `Could not remove ${symbol}.`);
      return;
    }

    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-700">NotiStock</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Dashboard
          </h1>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Signed in as <span className="font-semibold text-slate-950">{user.name}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Watchlist" value={items.length.toString()} />
        <MetricCard label="Active alerts" value={activeAlerts.toString()} />
        <MetricCard
          label="Best mover"
          value={
            items
              .slice()
              .sort((a, b) => (b.quote?.changePercent ?? 0) - (a.quote?.changePercent ?? 0))[0]
              ?.symbol ?? "-"
          }
        />
      </div>

      <StockSearch onAdd={handleAdd} watchlistSymbols={watchlistSymbols} />

      {message ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          {message}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-950">Watchlist</h2>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const quote = item.quote;
            const positive = (quote?.change ?? 0) >= 0;

            return (
              <div
                key={item.symbol}
                className="grid gap-3 px-4 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto]"
              >
                <Link href={getStockSearchPath(item.symbol)} className="min-w-0">
                  <p className="font-semibold text-slate-950">{item.symbol}</p>
                  <p className="truncate text-sm text-slate-500">{item.name}</p>
                </Link>
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
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  type="button"
                  onClick={() => handleRemove(item.symbol)}
                  title={`Remove ${item.symbol}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {!items.length && !loading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Add a symbol to start tracking.
            </div>
          ) : null}
        </div>
      </section>

      <FeaturedStocksSection
        title="Top 10 Largest Stocks"
        stocks={largestStocks}
        loading={loading}
        watchlistSymbols={watchlistSymbols}
        onAdd={handleAdd}
      />

      <FeaturedStocksSection
        title="Top 10 Most Volatile Stocks"
        stocks={volatileStocks}
        loading={loading}
        watchlistSymbols={watchlistSymbols}
        onAdd={handleAdd}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold text-slate-950">Current alerts</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.slice(0, 6).map((alert) => (
            <Link
              key={alert.id}
              href="/alerts"
              className="rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-950">{alert.symbol}</p>
              <p className="mt-1 text-sm text-slate-600">
                {alert.direction === "above" ? "Above" : "Below"}{" "}
                {formatCurrency(alert.targetPrice)}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase text-slate-400">
                {alert.status}
              </p>
            </Link>
          ))}
          {!alerts.length ? <p className="text-sm text-slate-500">No alerts yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

async function fetchStockQuote(symbol: string) {
  try {
    const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/quote`);
    if (!response.ok) return undefined;

    const data = (await response.json()) as { quote?: StockQuote };
    return data.quote;
  } catch {
    return undefined;
  }
}

async function loadFeaturedQuotes(stocks: FeaturedStock[]): Promise<FeaturedStockQuote[]> {
  return Promise.all(
    stocks.map(async (stock) => {
      const quote = await fetchStockQuote(stock.symbol);

      return {
        ...stock,
        quote: quote?.source === "finnhub" ? quote : undefined,
      };
    }),
  );
}

function FeaturedStocksSection({
  title,
  stocks,
  loading,
  watchlistSymbols,
  onAdd,
}: {
  title: string;
  stocks: FeaturedStockQuote[];
  loading: boolean;
  watchlistSymbols: Set<string>;
  onAdd: (stock: StockSearchResult) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
      </div>

      <div className="divide-y divide-slate-100">
        {stocks.map((stock) => (
          <FeaturedStockRow
            key={`${title}-${stock.symbol}`}
            stock={stock}
            isAdded={watchlistSymbols.has(stock.symbol)}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturedStockRow({
  stock,
  isAdded,
  onAdd,
}: {
  stock: FeaturedStockQuote;
  isAdded: boolean;
  onAdd: (stock: StockSearchResult) => Promise<void>;
}) {
  const quote = stock.quote;
  const positive = (quote?.change ?? 0) >= 0;

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
      <Link href={getStockSearchPath(stock.symbol)} className="min-w-0">
        <p className="text-xs font-semibold uppercase text-slate-400">
          #{stock.rank} - {stock.detail}
        </p>
        <p className="mt-1 font-semibold text-slate-950">{stock.symbol}</p>
        <p className="truncate text-sm text-slate-500">{stock.name}</p>
      </Link>
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
          {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {quote ? formatPercent(quote.changePercent) : "-"}
        </p>
      </div>
      <button
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
          isAdded
            ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 text-slate-700 hover:bg-slate-50",
        )}
        type="button"
        onClick={() => onAdd(stock)}
        disabled={isAdded}
        title={isAdded ? `${stock.symbol} is already in your watchlist` : `Add ${stock.symbol}`}
      >
        {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isAdded ? "Added" : "Add"}
      </button>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
