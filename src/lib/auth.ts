import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireOrganization() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("organization_members").select("organization_id, role, organizations(id, name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (error) throw new Error("Não foi possível verificar a organização atual.");
  if (!data) redirect("/onboarding");
  return { supabase, user, membership: data };
}
