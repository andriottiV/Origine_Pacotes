"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { authCallbackUrl, authOrigin } from "../../lib/auth-flow/origin";
import { authFailure, emailSchema, passwordPairSchema, recoveryMessage, signupMessage, signupSchema, type FlowState } from "../../lib/auth-flow/shared";
import { closeRecoverySession, getRecoveryGrant } from "../../lib/auth-flow/recovery";

export async function registerProfessional(form: FormData): Promise<FlowState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revise os campos indicados.", fieldErrors: Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])) };
  try {
    const origin = authOrigin((await headers()).get("origin"));
    const supabase = await createSupabaseServerClient();
    const { fullName, businessName, email, password } = parsed.data;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authCallbackUrl(origin, "signup"), data: { full_name: fullName, business_name: businessName, account_type: "professional" } } });
    if (error) {
      if (["user_already_exists", "email_exists"].includes(error.code || "")) return { success: signupMessage };
      return { error: authFailure(error) };
    }
    if (!data.session) return { success: signupMessage };
    // Confirmation may be disabled by the project owner. Still validate provisioning.
    const { error: provisioningError } = await supabase.rpc("complete_professional_signup");
    if (provisioningError) return { destination: "/auth/complete" };
    return { destination: "/auth/complete" };
  } catch { return { error: "Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente." }; }
}

export async function requestPasswordRecovery(form: FormData): Promise<FlowState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Informe um e-mail válido.", fieldErrors: { email: "Informe um e-mail válido." } };
  try {
    const origin = authOrigin((await headers()).get("origin"));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: authCallbackUrl(origin, "recovery") });
    if (error && (["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code || "") || error.status === 429 || !error.status || error.status >= 500 || error.name === "AuthRetryableFetchError")) return { error: authFailure(error) };
    // Identical response for missing users, provider restrictions, and delivered mail.
    return { success: recoveryMessage };
  } catch { return { error: "Não foi possível conectar ao serviço. Tente novamente em instantes." }; }
}

export async function saveRecoveredPassword(form: FormData): Promise<FlowState> {
  const parsed = passwordPairSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revise os campos indicados.", fieldErrors: Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])) };
  try {
    const grant = await getRecoveryGrant();
    if (!grant) return { error: "Este link expirou, já foi utilizado ou não é válido. Solicite outro link.", invalidLink: true };
    const usedAt = new Date().toISOString();
    // Conditional UPDATE is a single atomic claim, including concurrent submissions.
    const { data, error } = await grant.admin.from("password_recovery_grants").update({ used_at: usedAt }).eq("token_hash", grant.tokenHash).eq("user_id", grant.userId).eq("session_id", grant.sessionId).is("used_at", null).gt("expires_at", usedAt).select("token_hash").maybeSingle();
    if (error) return { error: "Não foi possível verificar o link. Tente novamente." };
    if (!data) return { error: "Este link expirou ou já foi utilizado. Solicite outro link.", invalidLink: true };
    const { error: passwordError } = await grant.supabase.auth.updateUser({ password: parsed.data.password });
    if (passwordError) {
      // Release only definite policy rejections. An unknown network outcome stays consumed.
      if (["weak_password", "same_password"].includes(passwordError.code || "")) {
        await grant.admin.from("password_recovery_grants").update({ used_at: null }).eq("token_hash", grant.tokenHash).eq("used_at", usedAt);
        return { error: authFailure(passwordError) };
      }
      await closeRecoverySession(grant.supabase);
      return { error: "Não foi possível confirmar a alteração. Solicite outro link para tentar novamente.", invalidLink: true };
    }
    await closeRecoverySession(grant.supabase);
    return { destination: "/login?status=senha-atualizada" };
  } catch { return { error: "Não foi possível concluir a recuperação. Solicite outro link para tentar novamente.", invalidLink: true }; }
}

export async function exitAuthFlow() {
  const supabase = await createSupabaseServerClient();
  await closeRecoverySession(supabase);
  redirect("/login");
}
