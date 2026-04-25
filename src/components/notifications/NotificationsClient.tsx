"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import type { NotificationHistoryItem } from "@/lib/types/notistock";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

export function NotificationsClient() {
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/notifications");
    const data = (await response.json()) as { notifications: NotificationHistoryItem[] };
    setItems(data.notifications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">NotiStock</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Notification history
          </h1>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_1fr_1fr_1fr]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-emerald-600" />
                  <p className="truncate font-semibold text-slate-950">{item.title}</p>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.body}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Symbol</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{item.symbol}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Prices</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.targetPrice ? formatCurrency(item.targetPrice) : "-"} target
                  {item.triggerPrice ? `, ${formatCurrency(item.triggerPrice)} trigger` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Delivery</p>
                <p className={cn("mt-1 text-sm font-semibold", statusColor(item.deliveryStatus))}>
                  {item.deliveryStatus}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
              </div>
            </div>
          ))}

          {!items.length && !loading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No notifications yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function statusColor(status: NotificationHistoryItem["deliveryStatus"]) {
  if (status === "sent") return "text-emerald-600";
  if (status === "simulated") return "text-amber-600";
  return "text-rose-600";
}
