"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { StockMarketSnapshot } from "@/components/stocks/StockMarketSnapshot";
import type {
  AlertDirection,
  AlertStatus,
  PriceAlert,
  StockQuote,
} from "@/lib/types/notistock";
import { cn, formatCurrency, formatDateTime, normalizeSymbol } from "@/lib/utils";

type QuoteStatus = "idle" | "checking" | "valid" | "invalid";

export function AlertsClient() {
  const searchParams = useSearchParams();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [symbol, setSymbol] = useState(normalizeSymbol(searchParams.get("symbol") ?? ""));
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>("idle");
  const [symbolError, setSymbolError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const targetNumber = Number(targetPrice);
  const hasValidTarget = Number.isFinite(targetNumber) && targetNumber > 0;
  const canSave = quoteStatus === "valid" && Boolean(quote) && hasValidTarget && !saving;
  const triggerPreview = useMemo(() => {
    if (!quote || !hasValidTarget) return null;

    return `${direction === "above" ? "At/above" : "At/below"} ${formatCurrency(targetNumber)}`;
  }, [direction, hasValidTarget, quote, targetNumber]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/alerts");
    const data = await readJsonResponse<{ alerts?: PriceAlert[]; error?: string }>(response);
    setAlerts(data.alerts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setQuote(null);
    setSymbolError("");

    if (!symbol) {
      setQuoteStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setQuoteStatus("checking");

      try {
        const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/quote`, {
          signal: controller.signal,
        });
        const data = await readJsonResponse<{ quote?: StockQuote; error?: string }>(response);

        if (!response.ok) {
          throw new Error(data.error ?? `Could not check ${symbol}.`);
        }

        if (data.quote?.source !== "finnhub") {
          setQuoteStatus("invalid");
          setSymbolError(`No live stock quote found for ${symbol}.`);
          return;
        }

        setQuote(data.quote);
        setQuoteStatus("valid");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setQuoteStatus("invalid");
        setSymbolError(error instanceof Error ? error.message : `Could not check ${symbol}.`);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [symbol]);

  useEffect(() => {
    if (!quote || !hasValidTarget) return;
    setDirection(targetNumber >= quote.price ? "above" : "below");
  }, [hasValidTarget, quote, targetNumber]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!quote || quote.source !== "finnhub") {
      setMessage("Choose a real stock with a live quote before saving an alert.");
      return;
    }

    if (!hasValidTarget) {
      setMessage("Target price must be greater than zero.");
      return;
    }

    setSaving(true);
    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/alerts/${editingId}` : "/api/alerts";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: quote.symbol, targetPrice: targetNumber, direction }),
    });
    const data = await readJsonResponse<{ error?: string }>(response);
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not save alert.");
      return;
    }

    setEditingId(null);
    setSymbol("");
    setTargetPrice("");
    setDirection("above");
    setQuote(null);
    setQuoteStatus("idle");
    await refresh();
    setMessage(editingId ? "Alert was updated." : "Alert was created.");
  }

  function edit(alert: PriceAlert) {
    setEditingId(alert.id);
    setSymbol(normalizeSymbol(alert.symbol));
    setTargetPrice(String(alert.targetPrice));
    setDirection(alert.direction);
    setMessage("");
  }

  function handleSymbolChange(value: string) {
    setSymbol(normalizeSymbol(value));
  }

  function handleTargetPriceChange(value: string) {
    setTargetPrice(value);

    const nextTarget = Number(value);
    if (quote && Number.isFinite(nextTarget) && nextTarget > 0) {
      setDirection(nextTarget >= quote.price ? "above" : "below");
    }
  }

  async function updateStatus(id: string, status: AlertStatus) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">NotiStock</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Price alerts
        </h1>
      </div>

      <section className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <form
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-950">
              {editingId ? "Edit alert" : "New alert"}
            </h2>
          </div>

          <div className="mt-4 space-y-4">
            {message ? (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                {message}
              </p>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Symbol</span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={symbol}
                onChange={(event) => handleSymbolChange(event.target.value)}
                placeholder="NVDA"
                required
                disabled={Boolean(editingId)}
              />
            </label>

            <QuoteStatusPanel
              quote={quote}
              status={quoteStatus}
              error={symbolError}
              triggerPreview={triggerPreview}
            />

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Target price</span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                type="number"
                min="0"
                step="0.01"
                value={targetPrice}
                onChange={(event) => handleTargetPriceChange(event.target.value)}
                required
              />
            </label>

            <div>
              <span className="text-sm font-medium text-slate-700">Condition</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["above", "below"] as const).map((option) => (
                  <button
                    key={option}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-semibold capitalize transition",
                      direction === option
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                    type="button"
                    onClick={() => setDirection(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canSave}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editingId ? "Save alert" : "Create alert"}
            </button>
          </div>
        </form>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Alerts</h2>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>

          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <div>
                  <p className="font-semibold text-slate-950">{alert.symbol}</p>
                  <p className="text-sm text-slate-500">
                    {alert.direction === "above" ? "Above" : "Below"}{" "}
                    {formatCurrency(alert.targetPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Status</p>
                  <p className={cn("mt-1 text-sm font-semibold", statusColor(alert.status))}>
                    {alert.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Triggered</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDateTime(alert.triggeredAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                    type="button"
                    title="Edit"
                    onClick={() => edit(alert)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {alert.status === "paused" ? (
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                      type="button"
                      title="Resume"
                      onClick={() => updateStatus(alert.id, "active")}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                      type="button"
                      title="Pause"
                      onClick={() => updateStatus(alert.id, "paused")}
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:bg-rose-50"
                    type="button"
                    title="Delete"
                    onClick={() => remove(alert.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {!alerts.length && !loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No alerts yet.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      {quoteStatus === "valid" && quote ? (
        <StockMarketSnapshot symbol={quote.symbol} />
      ) : null}
    </div>
  );
}

function QuoteStatusPanel({
  quote,
  status,
  error,
  triggerPreview,
}: {
  quote: StockQuote | null;
  status: QuoteStatus;
  error: string;
  triggerPreview: string | null;
}) {
  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking live quote
      </div>
    );
  }

  if (status === "invalid" || !quote) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
        {error || "No live quote found."}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-emerald-950">
            {quote.symbol} - {quote.name}
          </p>
          <p className="text-emerald-800">Current {formatCurrency(quote.price)}</p>
        </div>
        {triggerPreview ? (
          <p className="font-semibold text-emerald-900">{triggerPreview}</p>
        ) : null}
      </div>
    </div>
  );
}

function statusColor(status: AlertStatus) {
  if (status === "active") return "text-emerald-600";
  if (status === "paused") return "text-amber-600";
  if (status === "triggered") return "text-slate-700";
  return "text-rose-600";
}

async function readJsonResponse<T extends { error?: string }>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return { error: `Server returned ${response.status} with an empty response.` } as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: `Server returned ${response.status} instead of JSON.` } as T;
  }
}
