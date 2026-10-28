import AdminShell from "../../components/admin-shell";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import PackageCatalog from "./package-catalog";
import { connection } from "next/server";
export const instant = false;
export default async function PackagesPage(){ await connection(); const {supabase,membership}=await requireOrganization(); await supabase.rpc("ensure_default_package_types"); const {data,error}=await supabase.from("package_types").select("id,name,service_count,price,active").eq("organization_id",membership.organization_id).order("service_count"); if(error) throw new Error("Não foi possível carregar o catálogo."); return <AdminShell active="Pacotes" organization={membership.organizations}><main className="clients-page"><header className="clients-header"><Link className="text-link" href="/">← Início</Link><h1>Pacotes</h1><p>Configure os tipos de pacote disponíveis para venda.</p></header><PackageCatalog packages={data||[]}/></main></AdminShell>; }
