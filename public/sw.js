self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : {
        title: "NotiStock",
        body: "A price alert was triggered.",
        url: "/notifications",
      };

  event.waitUntil(
    self.registration.showNotification(data.title || "NotiStock", {
      body: data.body || "A price alert was triggered.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: {
        url: data.url || "/notifications",
        symbol: data.symbol,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.includes(url));
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(url);
    }),
  );
});
