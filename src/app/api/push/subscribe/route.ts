import { NextResponse } from "next/server";
import { upsertPushSubscription } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { subscription?: PushSubscriptionJSON };
  if (!body.subscription?.endpoint) {
    return NextResponse.json({ error: "Subscription endpoint is required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const record = await upsertPushSubscription(
    supabase,
    user.id,
    body.subscription,
    request.headers.get("user-agent"),
  );

  return NextResponse.json({ subscription: record });
}
