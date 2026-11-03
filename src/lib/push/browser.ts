"use client";
import { isPushConfiguration, type PushConfiguration } from "./configuration";
export class PushApiError extends Error { constructor(message: string, public status: number, public configuration?: PushConfiguration) { super(message); } }
export function supportsPush() {
  return Boolean(window.isSecureContext && "serviceWorker" in navigator && typeof navigator.serviceWorker?.register === "function" && typeof navigator.serviceWorker?.getRegistration === "function" && "PushManager" in window && typeof Notification !== "undefined" && typeof Notification?.requestPermission === "function");
}
export function needsHomeScreen() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !window.matchMedia("(display-mode: standalone)").matches && !(navigator as Navigator & { standalone?: boolean }).standalone;
}
export function applicationServerKey(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
}
export async function setLocalPushBinding(registration: ServiceWorkerRegistration, bindingToken: string | null) {
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) throw new Error("Service worker indisponível.");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Não foi possível configurar este aparelho.")); }, 5000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); if (event.data?.ok) resolve(); else reject(new Error("Não foi possível configurar este aparelho.")); };
    worker.postMessage({ type: "op-push-binding", bindingToken }, [channel.port2]);
  });
}
export async function clearLocalPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const results = await Promise.allSettled([
    setLocalPushBinding(registration, null),
    registration.pushManager?.getSubscription().then(sub => sub?.unsubscribe()),
    registration.getNotifications?.().then(items => items.forEach(item => item.close())),
  ]);
  if (results.some(result => result.status === "rejected")) throw new Error("Não foi possível limpar as notificações locais.");
}
export async function pushApi(path: string, method = "GET", value?: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/api/push/' + path, { method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: value === undefined ? undefined : { "Content-Type": "application/json" }, body: value === undefined ? undefined : JSON.stringify(value) });
    const result = await response.json();
    if (!response.ok) throw new PushApiError(result.error || "Não foi possível atualizar as notificações.", response.status, isPushConfiguration(result.configuration) ? result.configuration : undefined);
    return result;
  } finally { clearTimeout(timer); }
}
