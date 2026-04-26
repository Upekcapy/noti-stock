"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
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
  | "unsubscribed"
  | "error";

type SetupTone = "checking" | "ready" | "done" | "warning" | "error";
type ServiceWorkerStatus = "checking" | "ready" | "error" | "unsupported";
type SubscriptionStatus = "checking" | "saved" | "missing" | "error" | "unsupported";
type TestStatus = "idle" | "sending" | "sent" | "simulated" | "failed";

type DeviceInfo = {
  secureContext: boolean;
  localOrigin: boolean;
  android: boolean;
  chrome: boolean;
  installed: boolean;
  pushSupported: boolean;
  notificationPermission: NotificationPermission | "unsupported";
};

type PushTestResponse = {
  ok: boolean;
  simulated: boolean;
  sent: number;
  subscriptions: number;
  expiredRemoved: number;
  failed: number;
  payload?: { title: string };
  error?: string;
  notificationHistoryError?: string | null;
};

const initialDeviceInfo: DeviceInfo = {
  secureContext: false,
  localOrigin: false,
  android: false,
  chrome: false,
  installed: false,
  pushSupported: false,
  notificationPermission: "unsupported",
};

export function PushSettings() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<PushStatus>("checking");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(initialDeviceInfo);
  const [serviceWorkerStatus, setServiceWorkerStatus] =
    useState<ServiceWorkerStatus>("checking");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>("checking");
  const [subscriptionEndpoint, setSubscriptionEndpoint] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testCounts, setTestCounts] = useState<PushTestResponse | null>(null);

  const statusView = useMemo(() => getStatusView(status), [status]);
  const setupSteps = useMemo(
    () =>
      getSetupSteps({
        deviceInfo,
        installPrompt,
        serviceWorkerStatus,
        subscriptionStatus,
        status,
        testStatus,
        testCounts,
      }),
    [
      deviceInfo,
      installPrompt,
      serviceWorkerStatus,
      subscriptionStatus,
      status,
      testStatus,
      testCounts,
    ],
  );

  useEffect(() => {
    void refreshStatus();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setDeviceInfo(getDeviceInfo());
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setDeviceInfo(getDeviceInfo());
      setMessage("NotiStock is installed on this device.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setDeviceInfo(getDeviceInfo());
    standaloneQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  async function refreshStatus(options: { silent?: boolean } = {}) {
    if (!options.silent) setMessage("");
    setRefreshing(true);

    try {
      const nextDeviceInfo = getDeviceInfo();
      setDeviceInfo(nextDeviceInfo);

      if (!nextDeviceInfo.pushSupported) {
        setStatus("unsupported");
        setServiceWorkerStatus("unsupported");
        setSubscriptionStatus("unsupported");
        setSubscriptionEndpoint(null);
        return;
      }

      if (!publicVapidKey) {
        setStatus("missing-keys");
        setServiceWorkerStatus("checking");
        setSubscriptionStatus("unsupported");
        setSubscriptionEndpoint(null);
        return;
      }

      if (nextDeviceInfo.notificationPermission === "denied") {
        setStatus("blocked");
        setServiceWorkerStatus("checking");
        setSubscriptionStatus("missing");
        setSubscriptionEndpoint(null);
        return;
      }

      setServiceWorkerStatus("checking");
      const registration = await getServiceWorkerRegistration();
      setServiceWorkerStatus("ready");

      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        setStatus("unsubscribed");
        setSubscriptionStatus("missing");
        setSubscriptionEndpoint(null);
        return;
      }

      if (!subscriptionUsesCurrentKey(existing, publicVapidKey)) {
        await existing.unsubscribe();
        setStatus("unsubscribed");
        setSubscriptionStatus("missing");
        setSubscriptionEndpoint(null);
        setMessage("An old device subscription was removed. Tap Enable to create a fresh one.");
        return;
      }

      setSubscriptionStatus("checking");
      await saveSubscription(existing);
      setSubscriptionEndpoint(existing.endpoint);
      setSubscriptionStatus("saved");
      setStatus("subscribed");
    } catch (error) {
      setStatus("error");
      setServiceWorkerStatus("error");
      setSubscriptionStatus("error");
      setMessage(getErrorMessage(error, "Could not check this device's notification setup."));
    } finally {
      setRefreshing(false);
    }
  }

  async function installApp() {
    setMessage("");

    if (!installPrompt) {
      setMessage("Use Android Chrome's menu to install NotiStock, then open it from the icon.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setDeviceInfo(getDeviceInfo());
      setMessage("NotiStock was installed. Open it from your home screen for the app version.");
    } else {
      setMessage("Install was dismissed. You can try again from Chrome's install menu.");
    }
  }

  async function enableNotifications() {
    setLoading(true);
    setMessage("");
    setTestStatus("idle");

    try {
      const nextDeviceInfo = getDeviceInfo();
      setDeviceInfo(nextDeviceInfo);

      if (!nextDeviceInfo.pushSupported) {
        setStatus("unsupported");
        setMessage("This browser does not support phone push notifications.");
        return;
      }

      if (!publicVapidKey) {
        setStatus("missing-keys");
        setMessage("VAPID keys are missing. Add them in Vercel before testing a phone.");
        return;
      }

      const permission = await Notification.requestPermission();
      setDeviceInfo(getDeviceInfo());

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "unsubscribed");
        setMessage(
          permission === "denied"
            ? "Notifications are blocked for this site. Re-enable them in Chrome site settings."
            : "Notification permission was not granted.",
        );
        return;
      }

      setServiceWorkerStatus("checking");
      const registration = await getServiceWorkerRegistration();
      setServiceWorkerStatus("ready");

      const existing = await registration.pushManager.getSubscription();
      if (existing && !subscriptionUsesCurrentKey(existing, publicVapidKey)) {
        await existing.unsubscribe();
      }

      const current = await registration.pushManager.getSubscription();
      const subscription =
        current ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        }));

      setSubscriptionStatus("checking");
      await saveSubscription(subscription);
      setSubscriptionEndpoint(subscription.endpoint);
      setSubscriptionStatus("saved");
      setStatus("subscribed");
      setMessage("This device is subscribed. Send a random test alert next.");
    } catch (error) {
      setStatus("error");
      setSubscriptionStatus("error");
      setMessage(getErrorMessage(error, "Could not enable notifications on this device."));
      await refreshStatus({ silent: true });
    } finally {
      setLoading(false);
    }
  }

  async function disableNotifications() {
    setLoading(true);
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      } else if (subscriptionEndpoint) {
        await removeSubscription(subscriptionEndpoint);
      }

      setSubscriptionEndpoint(null);
      setSubscriptionStatus("missing");
      setStatus("unsubscribed");
      setMessage("Notifications are disabled on this device.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Could not disable notifications."));
      await refreshStatus({ silent: true });
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setMessage("");
    setTestStatus("sending");
    setTestCounts(null);

    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = await readJsonResponse<PushTestResponse>(response);
      setTestCounts(data);

      if (!response.ok || !data.ok) {
        setTestStatus("failed");
        setMessage(data.error ?? "Test notification failed.");
        return;
      }

      const title = data.payload?.title ?? "Test alert";
      if (data.simulated) {
        setTestStatus("simulated");
        setMessage(`${title} was recorded, but no real phone push was sent.`);
      } else {
        setTestStatus("sent");
        setMessage(`${title} sent to ${data.sent} device(s).`);
      }

      await refreshStatus({ silent: true });
    } catch (error) {
      setTestStatus("failed");
      setMessage(getErrorMessage(error, "Could not send a test notification."));
    } finally {
      setLoading(false);
    }
  }

  const canEnable =
    !loading &&
    deviceInfo.pushSupported &&
    Boolean(publicVapidKey) &&
    status !== "blocked";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">NotiStock</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Phone setup
          </h1>
        </div>
        <StatusBadge active={status === "subscribed"} label={statusView.label} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              <h2 className="font-semibold text-slate-950">Android phone readiness</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Use the production HTTPS site on Android Chrome, install the app, enable
              notifications, then send a test alert before relying on price alerts.
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={refreshing || loading}
            onClick={() => void refreshStatus()}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-100">
          {setupSteps.map((step) => (
            <SetupStepRow key={step.label} step={step} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-600" />
              <h2 className="font-semibold text-slate-950">Notification controls</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              These buttons subscribe this exact device, remove it, and verify the server
              can reach it through Web Push.
            </p>
          </div>
        </div>

        <div className={cn("mt-4 rounded-lg border p-3", statusView.className)}>
          <div className="flex items-start gap-2">
            <statusView.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">{statusView.description}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={!canEnable}
            onClick={enableNotifications}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Enable
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={loading || status !== "subscribed"}
            onClick={sendTest}
          >
            <Send className="h-4 w-4" />
            Send test
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={loading || status !== "subscribed"}
            onClick={disableNotifications}
          >
            <BellOff className="h-4 w-4" />
            Disable
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={deviceInfo.installed}
            onClick={installApp}
          >
            <Download className="h-4 w-4" />
            Install app
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

function SetupStepRow({
  step,
}: {
  step: { label: string; description: string; tone: SetupTone };
}) {
  const view = getToneView(step.tone);

  return (
    <div className="flex gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:items-center">
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:mt-0",
          view.iconClassName,
        )}
      >
        <view.icon className={cn("h-4 w-4", step.tone === "checking" ? "animate-spin" : "")} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-slate-950">{step.label}</p>
          <span
            className={cn(
              "inline-flex w-fit rounded-md px-2 py-1 text-xs font-semibold",
              view.badgeClassName,
            )}
          >
            {view.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{step.description}</p>
      </div>
    </div>
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

  if (status === "error") {
    return {
      label: "Needs attention",
      description: "Something failed while checking this device. Refresh or try enabling again.",
      icon: ShieldAlert,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    label: "Unsubscribed",
    description: "This device supports push notifications but has not been subscribed yet.",
    icon: Bell,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function getSetupSteps({
  deviceInfo,
  installPrompt,
  serviceWorkerStatus,
  subscriptionStatus,
  status,
  testStatus,
  testCounts,
}: {
  deviceInfo: DeviceInfo;
  installPrompt: InstallPromptEvent | null;
  serviceWorkerStatus: ServiceWorkerStatus;
  subscriptionStatus: SubscriptionStatus;
  status: PushStatus;
  testStatus: TestStatus;
  testCounts: PushTestResponse | null;
}) {
  const androidChrome = deviceInfo.android && deviceInfo.chrome;
  const secureTone: SetupTone =
    deviceInfo.secureContext && !deviceInfo.localOrigin
      ? "done"
      : deviceInfo.localOrigin
        ? "warning"
        : "error";
  const browserTone: SetupTone = !deviceInfo.pushSupported
    ? "error"
    : androidChrome
      ? "done"
      : "warning";
  const installTone: SetupTone = deviceInfo.installed
    ? "done"
    : installPrompt
      ? "ready"
      : "warning";
  const permissionTone: SetupTone =
    deviceInfo.notificationPermission === "granted"
      ? "done"
      : deviceInfo.notificationPermission === "denied"
        ? "error"
        : status === "missing-keys"
          ? "warning"
          : "ready";
  const workerTone = mapWorkerTone(serviceWorkerStatus);
  const subscriptionTone = mapSubscriptionTone(subscriptionStatus, status);
  const testTone = mapTestTone(testStatus);

  return [
    {
      label: "Secure phone origin",
      tone: secureTone,
      description: deviceInfo.secureContext
        ? deviceInfo.localOrigin
          ? "Localhost is fine for desktop checks. Use the Vercel HTTPS URL on your phone."
          : "This page is running on a secure production origin."
        : deviceInfo.localOrigin
          ? "Localhost is fine for desktop checks. Use the Vercel HTTPS URL on your phone."
          : "Phone push needs the production HTTPS Vercel URL.",
    },
    {
      label: "Android Chrome support",
      tone: browserTone,
      description: !deviceInfo.pushSupported
        ? "This browser cannot create Web Push subscriptions."
        : androidChrome
          ? "Android Chrome is detected and supports this setup."
          : "This browser can be checked here, but the target phone path is Android Chrome.",
    },
    {
      label: "App install",
      tone: installTone,
      description: deviceInfo.installed
        ? "NotiStock is running as an installed app."
        : installPrompt
          ? "The browser can install NotiStock from this page."
          : "Install from Android Chrome's menu if the install button is unavailable.",
    },
    {
      label: "Notification permission",
      tone: permissionTone,
      description:
        deviceInfo.notificationPermission === "granted"
          ? "This device has allowed notifications."
          : deviceInfo.notificationPermission === "denied"
            ? "Notifications are blocked for this site."
            : "Tap Enable to request notification permission from the browser.",
    },
    {
      label: "Service worker",
      tone: workerTone,
      description:
        serviceWorkerStatus === "ready"
          ? "The notification service worker is registered and ready."
          : serviceWorkerStatus === "error"
            ? "The service worker could not be registered."
            : serviceWorkerStatus === "unsupported"
              ? "This browser does not support service workers."
              : "Waiting for the notification service worker.",
    },
    {
      label: "Device subscription",
      tone: subscriptionTone,
      description:
        subscriptionStatus === "saved"
          ? "This device subscription is saved to your account."
          : subscriptionStatus === "error"
            ? "The device subscription could not be saved."
            : subscriptionStatus === "unsupported"
              ? "A subscription cannot be created until push support and keys are ready."
              : "Tap Enable to create and save this device subscription.",
    },
    {
      label: "Random test",
      tone: testTone,
      description: getTestDescription(testStatus, testCounts),
    },
  ];
}

function mapWorkerTone(status: ServiceWorkerStatus): SetupTone {
  if (status === "ready") return "done";
  if (status === "error" || status === "unsupported") return "error";
  return "checking";
}

function mapSubscriptionTone(status: SubscriptionStatus, pushStatus: PushStatus): SetupTone {
  if (status === "saved") return "done";
  if (status === "error") return "error";
  if (status === "unsupported") return pushStatus === "missing-keys" ? "warning" : "error";
  if (status === "checking") return "checking";
  return "ready";
}

function mapTestTone(status: TestStatus): SetupTone {
  if (status === "sent") return "done";
  if (status === "simulated") return "warning";
  if (status === "failed") return "error";
  if (status === "sending") return "checking";
  return "ready";
}

function getTestDescription(status: TestStatus, counts: PushTestResponse | null) {
  if (status === "sent") {
    return counts?.notificationHistoryError
      ? `Push sent, but history failed: ${counts.notificationHistoryError}`
      : `Server sent a real push to ${counts?.sent ?? 0} device(s).`;
  }

  if (status === "simulated") {
    return counts?.notificationHistoryError
      ? `Simulated, but history failed: ${counts.notificationHistoryError}`
      : `No real phone push was sent. Subscriptions: ${counts?.subscriptions ?? 0}.`;
  }

  if (status === "failed") {
    if (counts?.error) return `Test failed: ${counts.error}`;

    return `Test failed. Failed: ${counts?.failed ?? 0}, expired removed: ${
      counts?.expiredRemoved ?? 0
    }.`;
  }

  if (status === "sending") return "Sending a test notification now.";

  return "Send a test after this device is subscribed.";
}

function getToneView(tone: SetupTone) {
  if (tone === "done") {
    return {
      label: "Ready",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-100 text-emerald-700",
      badgeClassName: "bg-emerald-100 text-emerald-800",
    };
  }

  if (tone === "warning") {
    return {
      label: "Check",
      icon: ShieldAlert,
      iconClassName: "bg-amber-100 text-amber-800",
      badgeClassName: "bg-amber-100 text-amber-900",
    };
  }

  if (tone === "error") {
    return {
      label: "Fix",
      icon: XCircle,
      iconClassName: "bg-rose-100 text-rose-700",
      badgeClassName: "bg-rose-100 text-rose-800",
    };
  }

  if (tone === "checking") {
    return {
      label: "Checking",
      icon: Loader2,
      iconClassName: "bg-slate-100 text-slate-600",
      badgeClassName: "bg-slate-100 text-slate-700",
    };
  }

  return {
    label: "Next",
    icon: Bell,
    iconClassName: "bg-slate-100 text-slate-600",
    badgeClassName: "bg-slate-100 text-slate-700",
  };
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") return initialDeviceInfo;

  const userAgent = navigator.userAgent;
  const hostname = window.location.hostname;
  const localOrigin =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const pushSupported = isPushSupported();

  return {
    secureContext: window.isSecureContext,
    localOrigin,
    android: /Android/i.test(userAgent),
    chrome: /Chrome/i.test(userAgent) && !/Edg|OPR|SamsungBrowser/i.test(userAgent),
    installed: window.matchMedia("(display-mode: standalone)").matches || isIosStandalone(),
    pushSupported,
    notificationPermission: pushSupported ? Notification.permission : "unsupported",
  };
}

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  await registration.update().catch(() => undefined);
  await navigator.serviceWorker.ready;

  return registration;
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save this device's push subscription.");
  }
}

async function removeSubscription(endpoint: string) {
  const response = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not remove this device's push subscription.");
  }
}

function subscriptionUsesCurrentKey(subscription: PushSubscription, vapidKey: string) {
  const applicationServerKey = subscription.options.applicationServerKey;
  if (!applicationServerKey) return true;

  return arrayBufferToBase64Url(applicationServerKey) === normalizeBase64Url(vapidKey);
}

function isIosStandalone() {
  const maybeStandalone = navigator as Navigator & { standalone?: boolean };
  return Boolean(maybeStandalone.standalone);
}

function urlBase64ToUint8Array(value: string) {
  const rawData = window.atob(toBase64(value));
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function arrayBufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toBase64(value: string) {
  const normalized = normalizeBase64Url(value);
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return (normalized + padding).replace(/-/g, "+").replace(/_/g, "/");
}

function normalizeBase64Url(value: string) {
  return value.trim().replace(/=+$/, "");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function readJsonResponse<T extends { error?: string }>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return {
      error: `Server returned ${response.status} with an empty response. Check the deployment logs for /api/push/test.`,
    } as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: `Server returned ${response.status} instead of JSON. Check the deployment logs for /api/push/test.`,
    } as T;
  }
}
