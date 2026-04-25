import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const notifications = await listNotifications(supabase, user.id);

  return NextResponse.json({ notifications });
}
