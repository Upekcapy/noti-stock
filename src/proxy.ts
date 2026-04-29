import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth-constants";
import { env, isSupabaseConfigured } from "@/lib/env";

const protectedPrefixes = [
  "/about",
  "/alerts",
  "/dashboard",
  "/notifications",
  "/phone-setup",
  "/pricing",
  "/search",
  "/settings",
  "/stocks",
];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  const hasDemoSession = request.cookies.get(DEMO_SESSION_COOKIE)?.value === "1";
  const isAuthPage =
    request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (hasDemoSession) {
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (isProtected) return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)"],
};
