"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { StockSearch } from "@/components/stocks/StockSearch";
import type {
  AppUser,
  PriceAlert,
  StockQuote,
  StockSearchResult,
  WatchlistItem,
} from "@/lib/types/notistock";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type WatchlistQuote = WatchlistItem & { quote?: StockQuote };

export function DashboardClient({ user }: { user: AppUser }) {
  const [items, setItems] = useState<WatchlistQuote[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "active").length,
    [alerts],
  );

  const refresh = useCallback(async () => {
    setLoading(true);

    const [watchlistResponse, alertsResponse] = await Promise.all([
      fetch("/api/watchlist"),
      fetch("/api/alerts"),
    ]);
    const watchlistData = (await watchlistResponse.json()) as { items: WatchlistItem[] };
    const alertsData = (await alertsResponse.json()) as { alerts: PriceAlert[] };

    const quotes = await Promise.all(
      (watchlistData.items ?? []).map(async (item) => {
        const response = await fetch(`/api/stocks/${item.symbol}/quote`);
        const data = (await response.json()) as { quote: StockQuote };
        return { ...item, quote: data.quote };
      }),
    );

    setItems(quotes);
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

      <StockSearch onAdd={handleAdd} />

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
                <Link href={`/stocks/${item.symbol}`} className="min-w-0">
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
