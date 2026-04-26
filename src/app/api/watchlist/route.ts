import { NextResponse } from "next/server";
import {
  addWatchlistItem,
  listWatchlist,
  removeWatchlistItem,
} from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const items = await listWatchlist(supabase, user.id);

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { symbol?: string; name?: string };
  if (!body.symbol) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  try {
    const item = await addWatchlistItem(supabase, user.id, body.symbol, body.name);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: formatDataError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  try {
    await removeWatchlistItem(supabase, user.id, symbol);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: formatDataError(error) }, { status: 500 });
  }
}

function formatDataError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23503" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("watchlist_items_user_id_fkey")
  ) {
    return "Your profile row is missing in Supabase. Rerun the NotiStock migration to backfill profiles, then try again.";
  }

  return error instanceof Error ? error.message : "Could not update watchlist.";
}
