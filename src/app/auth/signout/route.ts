import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase?.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    expires: new Date(0),
    path: "/",
  });

  return response;
}
