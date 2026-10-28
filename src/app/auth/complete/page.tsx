import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import AuthLayout from "../../../components/auth-layout";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { recoveryClaims } from "../../../lib/auth-flow/shared";
export const instant = false;

export default async function CompleteSignupPage() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) redirect("/login");
  if (recoveryClaims(claims?.claims)) redirect("/redefinir-senha");
  const { data: client, error: clientError } = await supabase.rpc("has_client_identity");
  if (client) redirect("/cliente");
  if (!clientError) {
    const { data: organizationId, error: setupError } = await supabase.rpc("complete_professional_signup");
    if (!setupError && organizationId) redirect("/");
    // Preserve the existing first-time configuration for legacy accounts.
    if (!user.user_metadata.business_name && user.user_metadata.account_type !== "professional") redirect("/onboarding");
  }
  return <AuthLayout title="Vamos concluir sua configuração" intro="Sua conta está autenticada, mas não foi possível confirmar a configuração do negócio. Tente novamente; sua organização não será duplicada.">
    <Link className="button primary auth-submit" href="/auth/complete" prefetch={false}>Tentar concluir novamente</Link>
    <p className="auth-password-hint">Se o problema persistir, contate o responsável pelo sistema.</p>
  </AuthLayout>;
}
