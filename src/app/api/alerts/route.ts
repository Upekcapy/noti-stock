import { NextResponse } from "next/server";
import { addPriceAlert, listAlerts } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AlertDirection } from "@/lib/types/notistock";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const alerts = await listAlerts(supabase, user.id);

  return NextResponse.json({ alerts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    symbol?: string;
    targetPrice?: number | string;
    direction?: AlertDirection;
  };

  const targetPrice = Number(body.targetPrice);

  if (!body.symbol || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return NextResponse.json({ error: "Valid symbol and target price are required" }, { status: 400 });
  }

  if (body.direction !== "above" && body.direction !== "below") {
    return NextResponse.json({ error: "Direction must be above or below" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const alert = await addPriceAlert(supabase, user.id, {
    symbol: body.symbol,
    targetPrice,
    direction: body.direction,
  });

  return NextResponse.json({ alert }, { status: 201 });
}
