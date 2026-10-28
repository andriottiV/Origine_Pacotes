import { recoveryClaims } from "./auth-flow/shared";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) redirect("/login");
  if (recoveryClaims(claims?.claims)) redirect("/redefinir-senha");
  return { supabase, user };
}

export async function requireOrganization() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("organization_members").select("organization_id, role, organizations(id, name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (error) throw new Error("Não foi possível verificar a organização atual.");
  if (!data) redirect(user.user_metadata.account_type === "professional" ? "/auth/complete" : "/onboarding");
  return { supabase, user, membership: data };
}
