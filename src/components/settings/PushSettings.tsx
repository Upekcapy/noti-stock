"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Download,
  Loader2,
  Send,
  ShieldAlert,
  Smartphone,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PushStatus =
  | "checking"
  | "unsupported"
  | "missing-keys"
  | "blocked"
  | "subscribed"
  | "unsubscribed";

export function PushSettings() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PushStatus>("checking");
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [subscriptionEndpoint, setSubscriptionEndpoint] = useState<string | null>(null);

  const statusView = useMemo(() => getStatusView(status), [status]);

  useEffect(() => {
    void refreshStatus();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("NotiStock is installed on this device.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    setInstalled(standaloneQuery.matches || isIosStandalone());

    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      setInstalled(event.matches || isIosStandalone());
    };

    standaloneQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  async function refreshStatus() {
    if (!isPushSupported()) {
      setStatus("unsupported");
      setSubscriptionEndpoint(null);
      return;
    }

    if (!publicVapidKey) {
      setStatus("missing-keys");
      setSubscriptionEndpoint(null);
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("blocked");
      setSubscriptionEndpoint(null);
      return;
    }

    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      setSubscriptionEndpoint(subscription.endpoint);
      setStatus("subscribed");
      await saveSubscription(subscription);
      return;
    }

    setSubscriptionEndpoint(null);
    setStatus("unsubscribed");
  }

  async function installApp() {
    setMessage("");

    if (!installPrompt) {
      setMessage(
        "Open this site in Android Chrome, then use the browser menu to install NotiStock if the install button is unavailable.",
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setInstalled(true);
      setMessage("NotiStock was installed. Open it from your home screen for the app experience.");
    } else {
      setMessage("Install was dismissed. You can try again from Chrome's install menu.");
    }
  }

  async function enableNotifications() {
    setLoading(true);
    setMessage("");

    try {
      if (!isPushSupported()) {
        setStatus("unsupported");
        setMessage("This browser does not support web push notifications.");
        return;
      }

      if (!publicVapidKey) {
        setStatus("missing-keys");
        setMessage("VAPID keys are missing. Generate keys and add them to the environment.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "unsubscribed");
        setMessage("Notification permission was not granted.");
        return;
      }

      const registration = await getServiceWorkerRegistration();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        }));

      await saveSubscription(subscription);
      setSubscriptionEndpoint(subscription.endpoint);
      setStatus("subscribed");
      setMessage("Notifications are enabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
      await refreshStatus();
    } finally {
      setLoading(false);
    }
  }

  async function disableNotifications() {
    setLoading(true);
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      } else if (subscriptionEndpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscriptionEndpoint }),
        });
      }

      setSubscriptionEndpoint(null);
      setStatus("unsubscribed");
      setMessage("Notifications are disabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable notifications.");
      await refreshStatus();
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = (await response.json()) as {
        ok: boolean;
        simulated: boolean;
        sent: number;
        subscriptions: number;
        payload?: { title: string };
      };

      if (!response.ok) {
        setMessage("Test notification failed.");
        return;
      }

      setMessage(
        data.simulated
          ? `${data.payload?.title ?? "Test alert"} was recorded in simulated mode.`
          : `${data.payload?.title ?? "Test alert"} sent to ${data.sent} device(s).`,
      );
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send test notification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">NotiStock</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Settings
        </h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              <h2 className="font-semibold text-slate-950">Android app install</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Install NotiStock from Android Chrome to get a home-screen app icon. Push
              alerts will still use the same secure web notification subscription.
            </p>
          </div>
          <StatusBadge active={installed} label={installed ? "Installed" : "Not installed"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={installed}
            onClick={installApp}
          >
            <Download className="h-4 w-4" />
            Install app
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-600" />
              <h2 className="font-semibold text-slate-950">Phone notifications</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Enable push alerts on this device, then use the random test button before
              relying on price alerts.
            </p>
          </div>
          <StatusBadge active={status === "subscribed"} label={statusView.label} />
        </div>

        <div className={cn("mt-4 rounded-lg border p-3", statusView.className)}>
          <div className="flex items-start gap-2">
            <statusView.icon className="mt-0.5 h-4 w-4" />
            <p className="text-sm font-medium">{statusView.description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={loading || status === "unsupported" || status === "missing-keys" || status === "blocked"}
            onClick={enableNotifications}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Enable
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={loading || status !== "subscribed"}
            onClick={disableNotifications}
          >
            <BellOff className="h-4 w-4" />
            Disable
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={loading || status !== "subscribed"}
            onClick={sendTest}
          >
            <Send className="h-4 w-4" />
            Random test alert
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={() => void refreshStatus()}
          >
            Refresh status
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold",
        active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

function getStatusView(status: PushStatus) {
  if (status === "checking") {
    return {
      label: "Checking",
      description: "Checking this device's notification support.",
      icon: Loader2,
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (status === "unsupported") {
    return {
      label: "Unsupported",
      description: "This browser does not support service-worker push notifications.",
      icon: XCircle,
      className: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }

  if (status === "missing-keys") {
    return {
      label: "Needs keys",
      description: "VAPID keys are missing, so real phone push notifications cannot be sent yet.",
      icon: ShieldAlert,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (status === "blocked") {
    return {
      label: "Blocked",
      description: "Notifications are blocked in this browser. Re-enable them in site settings.",
      icon: XCircle,
      className: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }

  if (status === "subscribed") {
    return {
      label: "Subscribed",
      description: "This device is subscribed and can receive NotiStock push alerts.",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return {
    label: "Unsubscribed",
    description: "This device supports push notifications but has not been subscribed yet.",
    icon: Bell,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready.then(() => registration);
}

async function saveSubscription(subscription: PushSubscription) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

function isIosStandalone() {
  return "standalone" in navigator && Boolean(navigator.standalone);
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
