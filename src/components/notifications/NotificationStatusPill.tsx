"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type NotificationStatus =
  | "checking"
  | "ready"
  | "off"
  | "blocked"
  | "unsupported"
  | "missing-keys"
  | "stale"
  | "error";

export function NotificationStatusPill() {
  const [status, setStatus] = useState<NotificationStatus>("checking");

  const refreshStatus = useCallback(async () => {
    setStatus("checking");

    try {
      if (!isPushSupported()) {
        setStatus("unsupported");
        return;
      }

      if (!window.isSecureContext) {
        setStatus("unsupported");
        return;
      }

      if (!publicVapidKey) {
        setStatus("missing-keys");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("blocked");
        return;
      }

      if (Notification.permission !== "granted") {
        setStatus("off");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        setStatus("off");
        return;
      }

      if (!subscriptionUsesCurrentKey(subscription, publicVapidKey)) {
        setStatus("stale");
        return;
      }

      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };

    window.addEventListener("focus", refreshStatus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshStatus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshStatus]);

  const view = useMemo(() => getStatusView(status), [status]);
  const Icon = view.icon;

  return (
    <Link
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-white",
        view.className,
      )}
      href="/settings"
      title={view.title}
    >
      <Icon className={cn("h-4 w-4 shrink-0", status === "checking" ? "animate-spin" : "")} />
      <span className="whitespace-nowrap font-semibold">{view.label}</span>
      <span className="hidden truncate text-xs font-medium opacity-80 sm:inline">
        {view.description}
      </span>
    </Link>
  );
}

function getStatusView(status: NotificationStatus) {
  if (status === "ready") {
    return {
      label: "Notifications on",
      description: "This device can receive alerts",
      title: "Notifications are enabled for this device",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (status === "blocked") {
    return {
      label: "Notifications blocked",
      description: "Open site settings",
      title: "Notifications are blocked by the browser",
      icon: ShieldAlert,
      className: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }

  if (status === "missing-keys") {
    return {
      label: "Notifications unavailable",
      description: "VAPID keys missing",
      title: "Notification keys are missing",
      icon: ShieldAlert,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (status === "stale") {
    return {
      label: "Refresh notifications",
      description: "Open Settings",
      title: "This device has an old push subscription",
      icon: ShieldAlert,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (status === "unsupported") {
    return {
      label: "Notifications unsupported",
      description: "Use Android Chrome",
      title: "This browser does not support push notifications here",
      icon: BellOff,
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  if (status === "error") {
    return {
      label: "Check notifications",
      description: "Open Settings",
      title: "Could not check notification status",
      icon: ShieldAlert,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (status === "checking") {
    return {
      label: "Checking notifications",
      description: "One moment",
      title: "Checking notification status",
      icon: Loader2,
      className: "border-slate-200 bg-white text-slate-600",
    };
  }

  return {
    label: "Notifications off",
    description: "Enable in Settings",
    title: "Notifications are not enabled on this device",
    icon: Bell,
    className: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function subscriptionUsesCurrentKey(subscription: PushSubscription, vapidKey: string) {
  const applicationServerKey = subscription.options.applicationServerKey;
  if (!applicationServerKey) return true;

  return arrayBufferToBase64Url(applicationServerKey) === normalizeBase64Url(vapidKey);
}

function arrayBufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function normalizeBase64Url(value: string) {
  return value.trim().replace(/=+$/, "");
}
