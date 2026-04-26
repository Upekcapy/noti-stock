export const STOCK_RANGES = ["1D", "7D", "1M", "3M", "6M", "1Y", "3Y"] as const;

export type StockRange = (typeof STOCK_RANGES)[number];
export type AlertDirection = "above" | "below";
export type AlertStatus = "active" | "paused" | "triggered" | "deleted";
export type DeliveryStatus = "sent" | "failed" | "simulated";
export type StockHistorySource = "finnhub" | "nasdaq" | "demo" | "unavailable";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  isDemo?: boolean;
};

export type StockSearchResult = {
  symbol: string;
  name: string;
  market?: string;
};

export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  updatedAt: string;
  source: "finnhub" | "demo";
  sourceUrl?: string;
  details?: StockDetails;
};

export type StockDetails = {
  bid?: number;
  ask?: number;
  open?: number;
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  week52Low?: number;
  week52High?: number;
  volume?: string;
  marketCap?: string;
  sharesOutstanding?: string;
  dividend?: number;
  dividendYield?: number;
  peRatio?: number;
  eps?: number;
};

export type StockHistoryPoint = {
  time: number;
  value: number;
};

export type StockHistoryResult = {
  points: StockHistoryPoint[];
  source: StockHistorySource;
};

export type WatchlistItem = {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  createdAt: string;
};

export type PriceAlert = {
  id: string;
  userId: string;
  symbol: string;
  targetPrice: number;
  direction: AlertDirection;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  triggeredAt: string | null;
  lastCheckedPrice: number | null;
};

export type NotificationHistoryItem = {
  id: string;
  userId: string;
  alertId: string | null;
  symbol: string;
  title: string;
  body: string;
  targetPrice: number | null;
  triggerPrice: number | null;
  deliveryStatus: DeliveryStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  subscription: PushSubscriptionJSON;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlertInput = {
  symbol: string;
  targetPrice: number;
  direction: AlertDirection;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  symbol?: string;
};
