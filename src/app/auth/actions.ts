"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
export async function signOutAdmin(){const supabase=await createSupabaseServerClient();await supabase.auth.signOut({scope:"local"});redirect("/login");}
export async function signOutClient(){const supabase=await createSupabaseServerClient();await supabase.auth.signOut({scope:"local"});redirect("/cliente/login");}
