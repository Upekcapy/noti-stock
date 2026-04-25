import { NextResponse } from "next/server";
import { removePushSubscription } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  await removePushSubscription(supabase, user.id, body.endpoint);

  return NextResponse.json({ ok: true });
}
