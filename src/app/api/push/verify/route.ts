import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentDevice, privateJson, pushIdentity, sameOrigin, smallJson } from "@/lib/push/server";
const schema = z.object({ eventId: z.string().uuid(), bindingToken: z.string().uuid() }).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateJson({ allowed: false }, 403);
  try {
    if (process.env.PUSH_ENABLED !== "true") return privateJson({ allowed: false });
    const [identity, device] = await Promise.all([pushIdentity(), currentDevice()]);
    if (!identity || !device) return privateJson({ allowed: false }, 401);
    const input = schema.parse(await smallJson(request)); const admin = createSupabaseAdminClient();
    const { data: sub, error } = await admin.from("push_subscriptions").select("id").eq("device_hash", device.hash).eq("binding_token", input.bindingToken).eq("identity_id", identity.id).eq("user_id", identity.user_id).eq("active", true).maybeSingle();
    if (error || !sub) return privateJson({ allowed: false });
    const { data: allowed, error: allowedError } = await admin.rpc("push_delivery_allowed", { p_event_id: input.eventId, p_subscription_id: sub.id });
    return privateJson({ allowed: !allowedError && allowed === true });
  } catch { return privateJson({ allowed: false }, 503); }
}
