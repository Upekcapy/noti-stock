"use client";

import { useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PushSettings() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function enableNotifications() {
    setLoading(true);
    setMessage("");

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("This browser does not support web push notifications.");
      setLoading(false);
      return;
    }

    if (!publicVapidKey) {
      setMessage("VAPID keys are missing, so test notifications will be simulated.");
      setLoading(false);
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Notification permission was not granted.");
      setLoading(false);
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    setMessage("Notifications are enabled on this device.");
    setLoading(false);
  }

  async function disableNotifications() {
    setLoading(true);
    setMessage("");

    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }

    setMessage("Notifications are disabled on this device.");
    setLoading(false);
  }

  async function sendTest() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/push/test", { method: "POST" });
    const data = (await response.json()) as {
      ok: boolean;
      simulated: boolean;
      sent: number;
      subscriptions: number;
    };

    setMessage(
      data.simulated
        ? "Test notification was recorded in simulated mode."
        : `Test notification sent to ${data.sent} device(s).`,
    );
    setLoading(false);
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
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold text-slate-950">Phone notifications</h2>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={enableNotifications}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Enable
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={disableNotifications}
          >
            <BellOff className="h-4 w-4" />
            Disable
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={sendTest}
          >
            <Send className="h-4 w-4" />
            Test
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
