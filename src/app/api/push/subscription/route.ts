import { getPushConfiguration, getPushPublicKey } from "@/lib/push/config";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentDevice, deviceCookie, detachPushDevice, privateJson, pushIdentity, sameOrigin, smallJson } from "@/lib/push/server";
import { parsePushSubscription, resolvePushEndpoint } from "@/lib/push/endpoints";
import { defaultPushPreferences } from "@/lib/push/shared";
export async function GET() {
  try {
    const identity = await pushIdentity(); if (!identity) return privateJson({ error: "Entre no portal para administrar notificações." }, 401);
    const configuration = getPushConfiguration();
    if (!configuration.configured) return privateJson({ configuration, publicKey: "", active: false, preferences: defaultPushPreferences });
    const admin = createSupabaseAdminClient(); const device = await currentDevice();
    const [prefs, sub] = await Promise.all([
      admin.from("push_preferences").select("used,reversed,low_balance,expiring").eq("client_id", identity.client_id).eq("organization_id", identity.organization_id).maybeSingle(),
      device ? admin.from("push_subscriptions").select("active").eq("device_hash", device.hash).eq("identity_id", identity.id).eq("user_id", identity.user_id).eq("client_id", identity.client_id).eq("organization_id", identity.organization_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (prefs.error || sub.error) throw new Error("read_failed");
    return privateJson({ configuration, publicKey: getPushPublicKey(), active: sub.data?.active === true, preferences: prefs.data || defaultPushPreferences });
  } catch { return privateJson({ error: "Não foi possível consultar as notificações. Tente novamente." }, 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Origem inválida." }, 403);
  try {
    const identity = await pushIdentity(); if (!identity) return privateJson({ error: "Entre no portal para ativar notificações." }, 401);
    const configuration = getPushConfiguration();
    if (!configuration.configured) return privateJson({ error: "Configuração do servidor incompleta.", configuration }, 503);
    let sub;
    try { sub = parsePushSubscription(await smallJson(request)); await resolvePushEndpoint(sub.endpoint); }
    catch { return privateJson({ error: "Assinatura inválida ou provedor de push não autorizado." }, 400); }
    const device = (await currentDevice(true))!;
    const admin = createSupabaseAdminClient();
    const { data: token, error } = await admin.rpc("bind_push_subscription", { p_identity_id: identity.id, p_device_hash: device.hash, p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth });
    if (error) throw new Error("bind_failed");
    const { data: preferences, error: preferencesError } = await admin.from("push_preferences").select("used,reversed,low_balance,expiring").eq("client_id", identity.client_id).eq("organization_id", identity.organization_id).maybeSingle();
    if (preferencesError) throw new Error("preferences_failed");
    const response = NextResponse.json({ bindingToken: token, preferences: preferences || defaultPushPreferences }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
    response.cookies.set(deviceCookie, device.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 31536000 });
    return response;
  } catch { return privateJson({ error: "Não foi possível ativar neste aparelho. Tente novamente." }, 503); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Origem inválida." }, 403);
  try {
    if (!await pushIdentity()) return privateJson({ error: "Entre no portal para desativar notificações." }, 401);
    await detachPushDevice(); return privateJson({ success: true });
  } catch { return privateJson({ error: "Não foi possível confirmar a desativação no servidor. Tente novamente." }, 503); }
}
