import { getDemoQuote, getDemoStockMeta } from "@/lib/demo-data";
import {
  type AlertDirection,
  type AlertInput,
  type AlertStatus,
  type NotificationHistoryItem,
  type PriceAlert,
  type PushSubscriptionRecord,
  type WatchlistItem,
} from "@/lib/types/notistock";
import { normalizeSymbol } from "@/lib/utils";

const now = () => new Date().toISOString();

let watchlist: WatchlistItem[] = [
  {
    id: "demo-watch-aapl",
    userId: "demo-user",
    symbol: "AAPL",
    name: "Apple Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-nvda",
    userId: "demo-user",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    createdAt: now(),
  },
  {
    id: "demo-watch-tsla",
    userId: "demo-user",
    symbol: "TSLA",
    name: "Tesla, Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-jpm",
    userId: "demo-user",
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    createdAt: now(),
  },
  {
    id: "demo-watch-v",
    userId: "demo-user",
    symbol: "V",
    name: "Visa Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-ma",
    userId: "demo-user",
    symbol: "MA",
    name: "MasterCard Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-wmt",
    userId: "demo-user",
    symbol: "WMT",
    name: "Walmart Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-unh",
    userId: "demo-user",
    symbol: "UNH",
    name: "UnitedHealth Group Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-hd",
    userId: "demo-user",
    symbol: "HD",
    name: "Home Depot Inc.",
    createdAt: now(),
  },
  {
    id: "demo-watch-pg",
    userId: "demo-user",
    symbol: "PG",
    name: "Procter & Gamble Co.",
    createdAt: now(),
  },
  {
    id: "demo-watch-ko",
    userId: "demo-user",
    symbol: "KO",
    name: "Coca-Cola Co.",
    createdAt: now(),
  },
  {
    id: "demo-watch-bac",
    userId: "demo-user",
    symbol: "BAC",
    name: "Bank of America Corp.",
    createdAt: now(),
  },
  {
    id: "demo-watch-cost",
    userId: "demo-user",
    symbol: "COST",
    name: "Costco Wholesale Corp.",
    createdAt: now(),
  },
];

let alerts: PriceAlert[] = [
  {
    id: "demo-alert-nvda",
    userId: "demo-user",
    symbol: "NVDA",
    targetPrice: 900,
    direction: "above",
    status: "active",
    createdAt: now(),
    updatedAt: now(),
    triggeredAt: null,
    lastCheckedPrice: null,
  },
  {
    id: "demo-alert-tsla",
    userId: "demo-user",
    symbol: "TSLA",
    targetPrice: 175,
    direction: "below",
    status: "paused",
    createdAt: now(),
    updatedAt: now(),
    triggeredAt: null,
    lastCheckedPrice: null,
  },
];

let notifications: NotificationHistoryItem[] = [
  {
    id: "demo-note-aapl",
    userId: "demo-user",
    alertId: null,
    symbol: "AAPL",
    title: "AAPL crossed your target",
    body: "Apple Inc. moved above $210.00.",
    targetPrice: 210,
    triggerPrice: 214.68,
    deliveryStatus: "simulated",
    errorMessage: null,
    createdAt: now(),
  },
];

let subscriptions: PushSubscriptionRecord[] = [];

export function listDemoWatchlist(userId: string) {
  return watchlist.filter((item) => item.userId === userId);
}

export function addDemoWatchlistItem(userId: string, symbolInput: string) {
  const symbol = normalizeSymbol(symbolInput);
  const existing = watchlist.find((item) => item.userId === userId && item.symbol === symbol);

  if (existing) return existing;

  const meta = getDemoStockMeta(symbol);
  const item: WatchlistItem = {
    id: crypto.randomUUID(),
    userId,
    symbol,
    name: meta.name,
    createdAt: now(),
  };

  watchlist = [item, ...watchlist];
  return item;
}

export function removeDemoWatchlistItem(userId: string, symbolInput: string) {
  const symbol = normalizeSymbol(symbolInput);
  watchlist = watchlist.filter((item) => item.userId !== userId || item.symbol !== symbol);
}

export function listDemoAlerts(userId: string) {
  return alerts.filter((alert) => alert.userId === userId && alert.status !== "deleted");
}

export function addDemoAlert(userId: string, input: AlertInput) {
  const symbol = normalizeSymbol(input.symbol);
  const duplicate = alerts.find(
    (alert) =>
      alert.userId === userId &&
      alert.symbol === symbol &&
      alert.direction === input.direction &&
      alert.targetPrice === input.targetPrice &&
      alert.status === "active",
  );

  if (duplicate) return duplicate;

  const alert: PriceAlert = {
    id: crypto.randomUUID(),
    userId,
    symbol,
    direction: input.direction,
    targetPrice: input.targetPrice,
    status: "active",
    createdAt: now(),
    updatedAt: now(),
    triggeredAt: null,
    lastCheckedPrice: null,
  };

  alerts = [alert, ...alerts];
  return alert;
}

export function updateDemoAlert(
  userId: string,
  id: string,
  patch: Partial<Pick<PriceAlert, "targetPrice" | "direction" | "status">>,
) {
  let updated: PriceAlert | null = null;

  alerts = alerts.map((alert) => {
    if (alert.userId !== userId || alert.id !== id) return alert;

    updated = {
      ...alert,
      ...patch,
      status: (patch.status ?? alert.status) as AlertStatus,
      updatedAt: now(),
    };

    return updated;
  });

  return updated;
}

export function deleteDemoAlert(userId: string, id: string) {
  return updateDemoAlert(userId, id, { status: "deleted" });
}

export function listDemoNotifications(userId: string) {
  return notifications.filter((item) => item.userId === userId);
}

export function addDemoNotification(
  userId: string,
  item: Omit<NotificationHistoryItem, "id" | "userId" | "createdAt">,
) {
  const notification: NotificationHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    userId,
    createdAt: now(),
  };

  notifications = [notification, ...notifications];
  return notification;
}

export function upsertDemoSubscription(
  userId: string,
  subscription: PushSubscriptionJSON,
  userAgent: string | null,
) {
  const endpoint = subscription.endpoint ?? "";
  const existing = subscriptions.find(
    (item) => item.userId === userId && item.endpoint === endpoint,
  );

  if (existing) {
    existing.subscription = subscription;
    existing.userAgent = userAgent;
    existing.updatedAt = now();
    return existing;
  }

  const record: PushSubscriptionRecord = {
    id: crypto.randomUUID(),
    userId,
    endpoint,
    subscription,
    userAgent,
    createdAt: now(),
    updatedAt: now(),
  };

  subscriptions = [record, ...subscriptions];
  return record;
}

export function deleteDemoSubscription(userId: string, endpoint: string) {
  subscriptions = subscriptions.filter(
    (item) => item.userId !== userId || item.endpoint !== endpoint,
  );
}

export function listDemoSubscriptions(userId: string) {
  return subscriptions.filter((item) => item.userId === userId);
}

export function evaluateDemoAlerts(userId: string) {
  const triggered: PriceAlert[] = [];

  alerts = alerts.map((alert) => {
    if (alert.userId !== userId || alert.status !== "active") return alert;

    const quote = getDemoQuote(alert.symbol);
    const crossed =
      alert.direction === "above"
        ? quote.price >= alert.targetPrice
        : quote.price <= alert.targetPrice;

    if (!crossed) {
      return { ...alert, lastCheckedPrice: quote.price, updatedAt: now() };
    }

    const nextAlert = {
      ...alert,
      status: "triggered" as const,
      triggeredAt: now(),
      updatedAt: now(),
      lastCheckedPrice: quote.price,
    };

    triggered.push(nextAlert);
    return nextAlert;
  });

  return triggered;
}

export function isAlertDirection(value: unknown): value is AlertDirection {
  return value === "above" || value === "below";
}
