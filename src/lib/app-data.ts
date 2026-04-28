import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDemoAlert,
  addDemoNotification,
  addDemoWatchlistItem,
  deleteDemoAlert,
  deleteDemoSubscription,
  isAlertDirection,
  listActiveDemoAlerts,
  listDemoAlerts,
  listDemoNotifications,
  listDemoSubscriptions,
  listDemoWatchlist,
  markDemoAlertChecked,
  markDemoAlertTriggered,
  removeDemoWatchlistItem,
  updateDemoAlert,
  upsertDemoSubscription,
} from "@/lib/demo-store";
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

type WatchlistRow = {
  id: string;
  user_id: string;
  symbol: string;
  name: string | null;
  created_at: string;
};

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  direction: AlertDirection;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
  triggered_at: string | null;
  last_checked_price: number | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  alert_id: string | null;
  symbol: string;
  title: string;
  body: string;
  target_price: number | null;
  trigger_price: number | null;
  delivery_status: "sent" | "failed" | "simulated";
  error_message: string | null;
  created_at: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: PushSubscriptionJSON;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export async function listWatchlist(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<WatchlistItem[]> {
  if (!supabase) return listDemoWatchlist(userId);

  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as WatchlistRow[]).map(mapWatchlistRow);
}

export async function addWatchlistItem(
  supabase: SupabaseClient | null,
  userId: string,
  symbolInput: string,
  nameInput?: string,
) {
  const symbol = normalizeSymbol(symbolInput);

  if (!supabase) return addDemoWatchlistItem(userId, symbol);

  const { data: existing, error: existingError } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return mapWatchlistRow(existing as WatchlistRow);

  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      user_id: userId,
      symbol,
      name: nameInput ?? symbol,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapWatchlistRow(data as WatchlistRow);
}

export async function removeWatchlistItem(
  supabase: SupabaseClient | null,
  userId: string,
  symbolInput: string,
) {
  const symbol = normalizeSymbol(symbolInput);

  if (!supabase) {
    removeDemoWatchlistItem(userId, symbol);
    return;
  }

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("symbol", symbol);

  if (error) throw error;
}

export async function listAlerts(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<PriceAlert[]> {
  if (!supabase) return listDemoAlerts(userId);

  const { data, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as AlertRow[]).map(mapAlertRow);
}

export async function addPriceAlert(
  supabase: SupabaseClient | null,
  userId: string,
  input: AlertInput,
) {
  const symbol = normalizeSymbol(input.symbol);

  if (!isAlertDirection(input.direction) || !Number.isFinite(input.targetPrice)) {
    throw new Error("Invalid alert input.");
  }

  if (!supabase) return addDemoAlert(userId, { ...input, symbol });

  const { data: existing, error: existingError } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .eq("target_price", input.targetPrice)
    .eq("direction", input.direction)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return mapAlertRow(existing as AlertRow);

  const { data, error } = await supabase
    .from("price_alerts")
    .insert({
      user_id: userId,
      symbol,
      target_price: input.targetPrice,
      direction: input.direction,
      status: "active",
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapAlertRow(data as AlertRow);
}

export async function updatePriceAlert(
  supabase: SupabaseClient | null,
  userId: string,
  id: string,
  patch: Partial<Pick<PriceAlert, "targetPrice" | "direction" | "status">>,
) {
  if (!supabase) return updateDemoAlert(userId, id, patch);

  const dbPatch: Record<string, string | number> = {};
  if (patch.targetPrice !== undefined) dbPatch.target_price = patch.targetPrice;
  if (patch.direction !== undefined) dbPatch.direction = patch.direction;
  if (patch.status !== undefined) dbPatch.status = patch.status;

  const { data, error } = await supabase
    .from("price_alerts")
    .update(dbPatch)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapAlertRow(data as AlertRow);
}

export async function deletePriceAlert(
  supabase: SupabaseClient | null,
  userId: string,
  id: string,
) {
  if (!supabase) return deleteDemoAlert(userId, id);

  const { data, error } = await supabase
    .from("price_alerts")
    .update({ status: "deleted" })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapAlertRow(data as AlertRow);
}

export async function listNotifications(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<NotificationHistoryItem[]> {
  if (!supabase) return listDemoNotifications(userId);

  const { data, error } = await supabase
    .from("notification_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow);
}

export async function addNotification(
  supabase: SupabaseClient | null,
  userId: string,
  item: Omit<NotificationHistoryItem, "id" | "userId" | "createdAt">,
) {
  if (!supabase) return addDemoNotification(userId, item);

  const { data, error } = await supabase
    .from("notification_history")
    .insert({
      user_id: userId,
      alert_id: item.alertId,
      symbol: item.symbol,
      title: item.title,
      body: item.body,
      target_price: item.targetPrice,
      trigger_price: item.triggerPrice,
      delivery_status: item.deliveryStatus,
      error_message: item.errorMessage,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapNotificationRow(data as NotificationRow);
}

export async function upsertPushSubscription(
  supabase: SupabaseClient | null,
  userId: string,
  subscription: PushSubscriptionJSON,
  userAgent: string | null,
) {
  const endpoint = subscription.endpoint ?? "";

  if (!supabase) return upsertDemoSubscription(userId, subscription, userAgent);

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        subscription,
        user_agent: userAgent,
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapPushSubscriptionRow(data as PushSubscriptionRow);
}

export async function removePushSubscription(
  supabase: SupabaseClient | null,
  userId: string,
  endpoint: string,
) {
  if (!supabase) {
    deleteDemoSubscription(userId, endpoint);
    return;
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) throw error;
}

export async function listPushSubscriptions(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  if (!supabase) return listDemoSubscriptions(userId);

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as PushSubscriptionRow[]).map(mapPushSubscriptionRow);
}

export async function listActiveAlertsForCron(supabase: SupabaseClient | null) {
  if (!supabase) return listActiveDemoAlerts("demo-user");

  const { data, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as AlertRow[]).map(mapAlertRow);
}

export async function markAlertChecked(
  supabase: SupabaseClient | null,
  alert: PriceAlert,
  price: number,
) {
  if (!supabase) {
    markDemoAlertChecked(alert.id, price);
    return;
  }

  const { error } = await supabase
    .from("price_alerts")
    .update({ last_checked_price: price })
    .eq("id", alert.id);

  if (error) throw error;
}

export async function markAlertTriggered(
  supabase: SupabaseClient | null,
  alert: PriceAlert,
  price: number,
) {
  if (!supabase) {
    markDemoAlertTriggered(alert.id, price);
    return;
  }

  const { error } = await supabase
    .from("price_alerts")
    .update({
      status: "triggered",
      triggered_at: new Date().toISOString(),
      last_checked_price: price,
    })
    .eq("id", alert.id);

  if (error) throw error;
}

function mapWatchlistRow(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    createdAt: row.created_at,
  };
}

function mapAlertRow(row: AlertRow): PriceAlert {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    targetPrice: Number(row.target_price),
    direction: row.direction,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    triggeredAt: row.triggered_at,
    lastCheckedPrice: row.last_checked_price === null ? null : Number(row.last_checked_price),
  };
}

function mapNotificationRow(row: NotificationRow): NotificationHistoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    alertId: row.alert_id,
    symbol: row.symbol,
    title: row.title,
    body: row.body,
    targetPrice: row.target_price,
    triggerPrice: row.trigger_price,
    deliveryStatus: row.delivery_status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

function mapPushSubscriptionRow(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    subscription: row.subscription,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
