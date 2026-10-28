import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../supabase/server";
import { authOrigin } from "./origin";
import { issueRecoveryGrant, closeRecoverySession } from "./recovery";
import { recoveryClaims } from "./shared";

export async function handleAuthCallback(request: Request) {
  const query = new URL(request.url).searchParams;
  const flow = query.get("type") || query.get("flow");
  const safeFlow = flow === "recovery" ? "recovery" : "signup";
  const origin = authOrigin(new URL(request.url).origin);
  const response = (path: string) => {
    const result = NextResponse.redirect(new URL(path, origin), 303);
    result.headers.set("Cache-Control", "no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  };
  const invalid = () => response("/auth/erro?flow=" + safeFlow);
  const code = query.get("code");
  const tokenHash = query.get("token_hash");
  // Default ConfirmationURL links return a PKCE code, not tokens in the fragment.
  // Keep exactly one credential and reject ambiguous or error-bearing callbacks.
  const ambiguous = ["code", "token_hash", "flow", "type"].some(name => query.getAll(name).length > 1)
    || (query.has("flow") && query.has("type") && query.get("flow") !== query.get("type"));
  if (ambiguous || ["error", "error_code", "error_description", "access_token", "refresh_token"].some(name => query.has(name))
    || (!code && !tokenHash) || (code && tokenHash) || !["signup", "recovery"].includes(flow || "")) return invalid();
  const supabase = await createSupabaseServerClient();
  let exchanged = false;
  try {
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: flow as "signup" | "recovery" });
    if (result.error || !result.data.session || !result.data.user) return invalid();
    exchanged = true;
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) throw new Error("Sessão inválida");
    if (recoveryClaims(data.claims)) {
      await issueRecoveryGrant(supabase);
      return response("/redefinir-senha");
    }
    if (flow === "recovery") throw new Error("Sessão de recuperação obrigatória");
    const { data: client, error: clientError } = await supabase.rpc("has_client_identity");
    if (clientError || client) throw new Error("Cadastro administrativo indisponível");
    // The completion page retries the same idempotent DB transaction if necessary.
    return response("/auth/complete");
  } catch {
    if (exchanged) await closeRecoverySession(supabase);
    return invalid();
  }
}
