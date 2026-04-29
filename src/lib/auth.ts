import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE } from "@/lib/auth-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AppUser } from "@/lib/types/notistock";

export const demoUser: AppUser = {
  id: "demo-user",
  email: "demo@notistock.local",
  name: "Demo User",
  isDemo: true,
};

export async function getCurrentUser(): Promise<AppUser | null> {
  if (await hasDemoSession()) return demoUser;
  if (!isSupabaseConfigured) return demoUser;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return demoUser;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const appUser = {
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email.split("@")[0],
  };

  await ensureUserProfile(supabase, appUser);

  return appUser;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function createUserDataClient(user: AppUser) {
  if (user.isDemo) return null;

  return createServerSupabaseClient();
}

async function hasDemoSession() {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value === "1";
}

async function ensureUserProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  user: AppUser,
) {
  if (!supabase) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || data) {
    if (error) console.error("Could not read user profile", error);
    return;
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email,
    full_name: user.name,
  });

  if (insertError) console.error("Could not create user profile", insertError);
}
