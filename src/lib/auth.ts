import { redirect } from "next/navigation";
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
  if (!isSupabaseConfigured) return demoUser;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return demoUser;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return {
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email.split("@")[0],
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
