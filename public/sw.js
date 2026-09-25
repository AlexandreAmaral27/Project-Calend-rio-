self.addEventListener("push", event => {
  let data = {};
  try { data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "Família Barroso", {
      body: data.body || "Existe uma nova atualização no seu calendário.",
      icon: "/favicon.ico",
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
