import "server-only";
import { request } from "node:https";
import webpush from "web-push";
import { resolvePushEndpoint, UnsafePushEndpointError } from "./endpoints";
export type PushTarget = { endpoint: string; p256dh: string; auth_key: string };
export { pushConfigured } from "./config";
export async function sendPush(target: PushTarget, payload: string, ttl: number): Promise<number> {
  let pinned;
  try { pinned = await resolvePushEndpoint(target.endpoint); }
  catch (error) { return error instanceof UnsafePushEndpointError ? 400 : 0; } // DNS outages retry; unsafe destinations never connect.
  const details = webpush.generateRequestDetails({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth_key } }, payload, {
    vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
    TTL: Math.max(0, Math.min(ttl, 21600)), urgency: "normal",
  });
  return new Promise(resolve => {
    // No redirect handling. Pin the validated DNS result while TLS still checks
    // the original provider hostname, preventing DNS rebinding/SSRF at connect.
    let done = false;
    const finish = (code: number) => { if (!done) { done = true; clearTimeout(deadline); resolve(code); } };
    const req = request({ protocol: "https:", hostname: pinned.url.hostname, servername: pinned.url.hostname, port: 443,
      path: pinned.url.pathname + pinned.url.search, method: "POST", headers: details.headers,
      agent: false, family: pinned.family,
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
    }, response => { response.resume(); finish(response.statusCode || 0); });
    const deadline = setTimeout(() => { req.destroy(); finish(0); }, 6000);
    req.on("error", () => finish(0));
    req.end(details.body);
  });
}
