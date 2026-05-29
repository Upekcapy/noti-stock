import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";

const ADMIN_FETCH_TIMEOUT_MS = 12_000;
const ADMIN_FETCH_RETRY_DELAYS_MS = [300, 1_000];

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware refreshes them.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured) return null;

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: retryingAdminFetch,
    },
  });
}

const retryingAdminFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= ADMIN_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ADMIN_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (response.status < 500 || attempt === ADMIN_FETCH_RETRY_DELAYS_MS.length) {
        return response;
      }

      lastError = new Error(`Supabase returned ${response.status}`);
    } catch (error) {
      lastError = error;

      if (attempt === ADMIN_FETCH_RETRY_DELAYS_MS.length) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await delay(ADMIN_FETCH_RETRY_DELAYS_MS[attempt]);
  }

  throw lastError instanceof Error ? lastError : new Error("Supabase request failed");
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
