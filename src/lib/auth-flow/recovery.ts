import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "../supabase/admin";
import { createSupabaseServerClient } from "../supabase/server";
import { recoveryClaims } from "./shared";

export const recoveryCookie = "origine-recovery";
export const hashGrant = (token: string) => createHash("sha256").update(token).digest("hex");

export async function currentRecoveryIdentity(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (claimsError || !recoveryClaims(claims) || claims?.sub !== user.id || typeof claims.session_id !== "string") return null;
  return { userId: user.id, sessionId: claims.session_id };
}

export async function issueRecoveryGrant(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const identity = await currentRecoveryIdentity(supabase);
  if (!identity) throw new Error("Sessão de recuperação inválida.");
  const { data: client, error: clientError } = await supabase.rpc("has_client_identity");
  if (clientError || client) throw new Error("Recuperação administrativa indisponível.");
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 15 * 60_000);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("password_recovery_grants").insert({ token_hash: hashGrant(token), user_id: identity.userId, session_id: identity.sessionId, expires_at: expires.toISOString() });
  if (error) throw new Error("Não foi possível autorizar a recuperação.");
  const store = await cookies();
  store.set(recoveryCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function getRecoveryGrant() {
  const store = await cookies();
  const token = store.get(recoveryCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const supabase = await createSupabaseServerClient();
  const identity = await currentRecoveryIdentity(supabase);
  if (!identity) return null;
  const admin = createSupabaseAdminClient();
  const tokenHash = hashGrant(token);
  const { data, error } = await admin.from("password_recovery_grants").select("token_hash").eq("token_hash", tokenHash).eq("user_id", identity.userId).eq("session_id", identity.sessionId).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Não foi possível verificar a recuperação.");
  return data ? { supabase, admin, tokenHash, ...identity } : null;
}

export async function closeRecoverySession(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* The local session is still cleared below. */ } finally {
    const store = await cookies();
    store.delete(recoveryCookie);
    // Also clear local Auth cookies if signOut could not reach Auth.
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    const prefix = "sb-" + project + "-auth-token";
    for (const cookie of store.getAll()) if (cookie.name === prefix || cookie.name.startsWith(prefix + ".") || cookie.name === prefix + "-code-verifier" || cookie.name.startsWith(prefix + "-code-verifier.")) store.delete(cookie.name);
  }
}
