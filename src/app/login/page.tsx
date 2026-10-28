import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import LoginForm from "./login-form";
export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await connection();
  const passwordUpdated = (await searchParams).status === "senha-atualizada";
  let user, configurationError;
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch { configurationError = "Não foi possível verificar o acesso neste ambiente."; }
  // Next redirects throw; do not catch them as configuration failures.
  if (user) redirect("/auth/complete");
  return <LoginForm configurationError={configurationError} passwordUpdated={passwordUpdated} />;
}
