import AdminShell from "../../components/admin-shell";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import ClientsManager from "./clients-manager";
import { connection } from "next/server";
export const instant = false;
export default async function ClientsPage({searchParams}:{searchParams:Promise<{q?:string}>}) { await connection(); const {supabase,membership}=await requireOrganization(); const q=(await searchParams).q?.trim()||""; let query=supabase.from("clients").select("id,full_name,phone_normalized,notes,status,created_at").eq("organization_id",membership.organization_id).order("created_at",{ascending:false}); if(q)query=query.or(`full_name.ilike.%${q}%,phone_normalized.ilike.%${q}%`); const {data,error}=await query; if(error)throw new Error("Não foi possível carregar os clientes."); return <AdminShell active="Clientes" organization={membership.organizations}><main className="clients-page"><header className="clients-header"><Link className="text-link" href="/">← Início</Link><h1>Clientes</h1><p>Cadastre e acompanhe os clientes da sua barbearia.</p></header><ClientsManager clients={data||[]} query={q}/></main></AdminShell>; }
