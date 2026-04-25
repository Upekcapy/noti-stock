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
  const item = await addWatchlistItem(supabase, user.id, body.symbol, body.name);

  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  await removeWatchlistItem(supabase, user.id, symbol);

  return NextResponse.json({ ok: true });
}
