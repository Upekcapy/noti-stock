import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/app-data";
import { createUserDataClient, getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createUserDataClient(user);
  const notifications = await listNotifications(supabase, user.id);

  return NextResponse.json({ notifications });
}
