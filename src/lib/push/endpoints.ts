import "server-only";
import { ECDH } from "node:crypto";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { z } from "zod";
export const subscriptionSchema = z.object({
  endpoint: z.string().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().regex(/^[\w-]{87}$/), auth: z.string().regex(/^[\w-]{22}$/) }).strict(),
}).strict();
export class UnsafePushEndpointError extends Error { constructor() { super("invalid_push_destination"); } }
export function pushEndpoint(value: string) {
  let u: URL;
  try { u = new URL(value); } catch { throw new UnsafePushEndpointError(); }
  const host = u.hostname.toLowerCase();
  const allowed = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(host)
    || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  if (!allowed || u.protocol !== "https:" || u.port || u.username || u.password || u.hash || u.href.length > 2048) throw new UnsafePushEndpointError();
  return u;
}
export function isPublicAddress(address: string) {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  return parsed.range() === "unicast";
}
export async function resolvePushEndpoint(value: string) {
  const url = pushEndpoint(value);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([lookup(url.hostname, { all: true, verbatim: true }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("dns_timeout")), 3000); })]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new UnsafePushEndpointError();
  const pinned = addresses.find(item => item.family === 4) || addresses[0];
  return { url, address: pinned.address, family: pinned.family as 4 | 6 };
}
export function parsePushSubscription(value: unknown) {
  const sub = subscriptionSchema.parse(value);
  pushEndpoint(sub.endpoint);
  const publicKey = Buffer.from(sub.keys.p256dh, "base64url");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || Buffer.from(sub.keys.auth, "base64url").length !== 16) throw new Error("invalid_push_keys");
  ECDH.convertKey(publicKey, "prime256v1");
  if (sub.expirationTime != null && sub.expirationTime <= Date.now()) throw new Error("expired_push_subscription");
  return sub;
}
