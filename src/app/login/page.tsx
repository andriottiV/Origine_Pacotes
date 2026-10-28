import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";
import { connection } from "next/server";
export const instant = false;

export default async function LoginPage() {
  await connection();
  try { const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) redirect("/"); } catch (error) { return <LoginForm configurationError={error instanceof Error ? error.message : "Configuração indisponível."}/>; }
  return <LoginForm />;
}
