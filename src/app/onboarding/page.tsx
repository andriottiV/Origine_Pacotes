import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";
import { connection } from "next/server";
export const instant = false;

export default async function OnboardingPage() {
  await connection();
  const { supabase, user } = await requireUser(); const { data } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle(); if (data) redirect("/");
  return <main className="auth-page"><OnboardingForm /></main>;
}
