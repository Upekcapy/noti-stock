import { NextResponse } from "next/server";
import { deletePriceAlert, updatePriceAlert } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AlertDirection, AlertStatus } from "@/lib/types/notistock";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as {
    targetPrice?: number | string;
    direction?: AlertDirection;
    status?: AlertStatus;
  };

  const patch: {
    targetPrice?: number;
    direction?: AlertDirection;
    status?: AlertStatus;
  } = {};

  if (body.targetPrice !== undefined) {
    const targetPrice = Number(body.targetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      return NextResponse.json({ error: "Target price must be positive" }, { status: 400 });
    }
    patch.targetPrice = targetPrice;
  }

  if (body.direction !== undefined) {
    if (body.direction !== "above" && body.direction !== "below") {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
    }
    patch.direction = body.direction;
  }

  if (body.status !== undefined) {
    if (!["active", "paused", "triggered", "deleted"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }

  const supabase = await createServerSupabaseClient();
  const alert = await updatePriceAlert(supabase, user.id, id, patch);

  return NextResponse.json({ alert });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  await deletePriceAlert(supabase, user.id, id);

  return NextResponse.json({ ok: true });
}
