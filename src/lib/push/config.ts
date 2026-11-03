import "server-only";
export function pushConfigured() {
  return process.env.PUSH_ENABLED === "true" && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
