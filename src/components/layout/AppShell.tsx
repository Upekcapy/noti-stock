"use client";

import {
  Bell,
  Home,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppUser } from "@/lib/types/notistock";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/notifications", label: "History", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  user,
}: Readonly<{
  children: React.ReactNode;
  user: AppUser;
}>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Brand />
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          {user.isDemo ? (
            <p className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              Demo data active
            </p>
          ) : null}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:flex">
              <Search className="h-4 w-4" />
              <span>Search tickers and open stock charts</span>
            </div>
            <form action="/auth/signout" method="post">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                type="submit"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
          <nav className="grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-emerald-700" : "text-slate-500",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white">
        <TrendingUp className="h-5 w-5" />
      </span>
      {!compact ? (
        <span>
          <span className="block text-lg font-semibold tracking-tight">NotiStock</span>
          <span className="block text-xs font-medium text-slate-500">Price alerts</span>
        </span>
      ) : (
        <span className="text-lg font-semibold tracking-tight">NotiStock</span>
      )}
    </Link>
  );
}
