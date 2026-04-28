import { NextResponse } from "next/server";
import { evaluateAlertWithQuote } from "@/lib/alert-evaluator";
import { addPriceAlert, listAlerts } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { getLiveStockQuote } from "@/lib/stocks";
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

  try {
    const body = (await request.json()) as {
      symbol?: string;
      targetPrice?: number | string;
      direction?: AlertDirection;
    };

    const targetPrice = Number(body.targetPrice);

    if (!body.symbol || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      return NextResponse.json(
        { error: "Valid symbol and target price are required" },
        { status: 400 },
      );
    }

    if (body.direction !== "above" && body.direction !== "below") {
      return NextResponse.json({ error: "Direction must be above or below" }, { status: 400 });
    }

    const liveQuote = await getLiveStockQuote(body.symbol, { includeProfile: false });
    if (!liveQuote) {
      return NextResponse.json(
        { error: "Choose a real stock symbol with a live quote before creating an alert." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const alert = await addPriceAlert(supabase, user.id, {
      symbol: liveQuote.symbol,
      targetPrice,
      direction: body.direction,
    });
    const evaluation = await evaluateAlertWithQuote(supabase, alert, liveQuote);

    return NextResponse.json({ alert, evaluation }, { status: 201 });
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
    error.message.includes("price_alerts_user_id_fkey")
  ) {
    return "Your profile row is missing in Supabase. Rerun the NotiStock migration to backfill profiles, then try again.";
  }

  return error instanceof Error ? error.message : "Could not save alert.";
}
