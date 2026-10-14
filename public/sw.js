/**
 * expire365-v27 — push + cache cleanup only.
 * Does not cache pages or intercept fetches (that broke phone login).
 * Must stay registered: PushManager.subscribe needs an active worker.
 *
 * No large `icon` — with the PWA installed, Chrome already shows the app
 * icon on the left. A second `icon` only added a duplicate on the right.
 * Badge stays a monochrome silhouette for the status bar.
 */
const BADGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABwElEQVR4nO3VS27EQAgE0Lr/pYmyi6z4000BhU1JrOKh6WdmAjPDlJ0aDI5dL8gA2QDB8xMyG2QDhNkgi/tPPF8xGyDMBtl8xfDF36DVfAKIldcBRaU9UFbaAT1NRL/V3ulAd8ncSjmgq1RsqRTQWSK2NO2ldMdBB6BKnLZAGCCTwDl7SbTenTcHCzNKAOHmmcitCTs7enuOicA56005O3J7cHIRL9RKvxKg/7L6/N1nVvpc9fKeSQGC43KROJQtygIC6YK7l93CyQbCxmUZOC4kL85vGD3M8dzqmalAIAx87HcVfB3oKvgSEC4puOe0BUISTmsgJOC4SgEIJJyVtAPCZt/dtARCAkw4EIqRWHklECt4IxAzrwOybkDwHlqIM0A3WX5JzDeLou2BIhBEgEJxvEAIRGLjyABZElAKDgMI7IEeXH4VpxwIAUgSOEwgkIdj4UgBgTgkCwhqQCANK4ETBQTC4N5AHQjOyxz/XoITDQTHNvz93NMeIfNnAGFzC57ihM6dCYTNbUhHqQaCyuU7AEG9ygcw8SofwMSrfAATr/IBTLzKBzDxKh/AxKt8ABOv8gFMvMoHMPEqH8DE6wfdyT1HnzMXRQAAAABJRU5ErkJggg==";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) {
        /* ignore */
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "expire365";
      let body = "";
      let url = "/app";

      try {
        const data = event.data ? event.data.json() : null;
        if (data && typeof data === "object") {
          if (typeof data.title === "string" && data.title.trim()) {
            title = data.title.trim();
          }
          if (typeof data.body === "string") body = data.body;
          if (typeof data.url === "string" && data.url.startsWith("/")) {
            url = data.url;
          }
        }
      } catch (_) {
        const text = event.data ? event.data.text() : "";
        if (text) body = text;
      }

      await self.registration.showNotification(title, {
        body,
        data: { url },
        badge: BADGE_DATA_URL,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const path =
    typeof raw === "string" && raw.startsWith("/") ? raw : "/app";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(path);
            } catch (_) {
              /* ignore */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(path);
      }
    })(),
  );
});
