import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 12);
}

export function getStockSearchPath(symbol: string) {
  return `/search?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`;
}

export function isAboveTarget(price: number, target: number) {
  return price >= target;
}

export function isBelowTarget(price: number, target: number) {
  return price <= target;
}

export function getAbsoluteUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;
  return new URL(path, normalizedBase).toString();
}
