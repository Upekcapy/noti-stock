self.addEventListener("push", (event) => {
  let data = {
    title: "NotiStock",
    body: "A price alert was triggered.",
    url: "/notifications",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "NotiStock", {
      body: data.body || "A price alert was triggered.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.symbol ? `notistock-${data.symbol}` : "notistock-alert",
      renotify: true,
      data: {
        url: data.url || "/notifications",
        symbol: data.symbol,
      },
      actions: [
        {
          action: "open",
          title: "Open NotiStock",
        },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url === url);
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
