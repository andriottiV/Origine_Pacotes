/* No fetch handler and no offline cache: private portal responses stay private. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function destination(value) {
  if (value === "/cliente" || (typeof value === "string" && /^\/cliente\/pacotes\/[0-9a-f-]{36}$/i.test(value) && UUID.test(value.split("/").pop()))) return value;
  return "/cliente";
}
function binding(value, write = false) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("origine-push", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("device");
    open.onerror = () => reject(new Error("binding_unavailable"));
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction("device", write ? "readwrite" : "readonly");
      const store = tx.objectStore("device"); let result = null;
      if (write) { if (value) store.put(value, "binding"); else store.delete("binding"); }
      else { const read = store.get("binding"); read.onsuccess = () => { result = read.result || null; }; }
      tx.oncomplete = () => { db.close(); resolve(write ? value : result); };
      tx.onerror = () => { db.close(); reject(new Error("binding_unavailable")); };
    };
  });
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin || event.data?.type !== "op-push-binding") return;
  const token = event.data.bindingToken;
  if (token !== null && (typeof token !== "string" || !UUID.test(token))) return;
  event.waitUntil(binding(token, true).then(async () => {
    if (!token) { const notifications = await self.registration.getNotifications(); notifications.forEach(n => n.close()); }
    event.ports[0]?.postMessage({ ok: true });
  }).catch(() => event.ports[0]?.postMessage({ ok: false })));
});
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    try {
      const payload = event.data?.json();
      if (!payload || !UUID.test(payload.eventId) || !UUID.test(payload.bindingToken) || typeof payload.body !== "string" || payload.body.length > 500) return;
      if (await binding() !== payload.bindingToken) return;
      const response = await fetch("/api/push/verify", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: payload.eventId, bindingToken: payload.bindingToken }) });
      if (!response.ok || !(await response.json()).allowed || await binding() !== payload.bindingToken) return;
      await self.registration.showNotification("Origine Pacotes", { body: payload.body, icon: "/icons/origine-192-v1.png", badge: "/icons/origine-badge-96-v1.png", tag: "origine-" + payload.eventId, data: { url: destination(payload.url) } });
    } catch { /* Fail closed if the current account cannot be verified. No logs. */ }
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close(); const path = destination(event.notification.data?.url);
  event.waitUntil((async () => {
    const url = new URL(path, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) if (new URL(client.url).origin === self.location.origin) { try { await client.navigate(url); await client.focus(); return; } catch { /* Window may have closed; try another or open one. */ } }
    await self.clients.openWindow(url);
  })());
});
self.addEventListener("pushsubscriptionchange", event => event.waitUntil(binding(null, true)));
