import { NextResponse } from "next/server";
import { upsertPushSubscription } from "@/lib/app-data";
import { createUserDataClient, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { subscription?: PushSubscriptionJSON };
  if (!body.subscription?.endpoint) {
    return NextResponse.json({ error: "Subscription endpoint is required" }, { status: 400 });
  }

  const supabase = await createUserDataClient(user);
  const record = await upsertPushSubscription(
    supabase,
    user.id,
    body.subscription,
    request.headers.get("user-agent"),
  );

  return NextResponse.json({ subscription: record });
}
