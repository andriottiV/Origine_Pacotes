import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recoveryClaims } from "@/lib/auth-flow/shared";
export const deviceCookie = process.env.NODE_ENV === "production" ? "__Host-op_push_device" : "op_push_device";
export function hashDevice(value: string) { return createHash("sha256").update(value).digest("hex"); }
export async function currentDevice(create = false) {
  const store = await cookies();
  const current = store.get(deviceCookie)?.value;
  const value = current && /^[\w-]{43}$/.test(current) ? current : create ? randomBytes(32).toString("base64url") : null;
  return value ? { value, hash: hashDevice(value) } : null;
}
export async function pushIdentity(existing?: SupabaseClient) {
  const session = existing || await createSupabaseServerClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const { data, error: claimsError } = await session.auth.getClaims();
  if (claimsError || !data?.claims || recoveryClaims(data.claims)) return null;
  const { data: identity, error: identityError } = await session.from("client_identities").select("id,client_id,organization_id,user_id").eq("user_id", user.id).is("revoked_at", null).maybeSingle();
  if (identityError) throw new Error("identity_unavailable");
  return identity;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : new URL(request.url).origin;
  return origin === expected || (process.env.NODE_ENV !== "production" && origin === new URL(request.url).origin);
}
export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" } });
}
export async function detachPushDevice() {
  const device = await currentDevice();
  if (!device) return;
  const { error } = await createSupabaseAdminClient().rpc("unbind_push_device", { p_device_hash: device.hash });
  if (error) throw new Error("Não foi possível desvincular as notificações deste aparelho. Tente sair novamente.");
}
export async function smallJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("invalid_content_type");
  const reader = request.body?.getReader(); if (!reader) throw new Error("empty_body");
  const parts: Uint8Array[] = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) { await reader.cancel(); throw new Error("body_too_large"); } parts.push(value); }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
