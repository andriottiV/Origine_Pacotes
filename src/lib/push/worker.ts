import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { pushBody, safePushDestination, type PushKind } from "./shared";
import { pushConfigured, sendPush } from "./transport";
type Claim = { event_id: string; subscription_id: string; claim_token: string };
type Authorized = { endpoint: string; p256dh: string; auth_key: string; binding_token: string; kind: PushKind; quantity: number | null; remaining: number; client_package_id: string; expires_at: string };
export async function processPushBatch(limit = 5) {
  if (!pushConfigured()) return { configured: false, claimed: 0, accepted: 0 };
  const admin = createSupabaseAdminClient();
  const { data: claims, error } = await admin.rpc("claim_push_deliveries", { p_limit: Math.min(limit, 20) });
  if (error) throw new Error("push_claim_failed");
  let accepted = 0;
  // At most five concurrent sends. Delivery is tracked independently per device.
  const rows = (claims || []) as Claim[];
  for (let offset = 0; offset < rows.length; offset += 5) {
    await Promise.allSettled(rows.slice(offset, offset + 5).map(async claim => {
      const args = { p_event_id: claim.event_id, p_subscription_id: claim.subscription_id, p_claim_token: claim.claim_token };
      const { data, error: authError } = await admin.rpc("authorize_push_delivery", args);
      if (authError) return; // Lease will expire; do not guess delivery state.
      const event = (data?.[0] || null) as Authorized | null;
      let code = 499;
      if (event) {
        try {
          const payload = JSON.stringify({ eventId: claim.event_id, bindingToken: event.binding_token,
            body: pushBody({ ...event, remaining: Number(event.remaining) }),
            url: safePushDestination('/cliente/pacotes/' + event.client_package_id) });
          code = await sendPush(event, payload, Math.floor((Date.parse(event.expires_at) - Date.now()) / 1000));
        } catch { code = 0; } // Never log provider errors: they can contain capabilities.
      }
      if (code >= 200 && code < 300) accepted++;
      await admin.rpc("finish_push_delivery", { ...args, p_binding_token: event?.binding_token || null, p_code: code });
    }));
  }
  return { configured: true, claimed: rows.length, accepted };
}
