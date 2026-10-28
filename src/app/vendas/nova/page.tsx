import AdminShell from "../../../components/admin-shell";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import SaleForm from "./sale-form";
import { connection } from "next/server";
export const instant=false;
export default async function NewSalePage(){await connection();const {supabase,membership}=await requireOrganization();const [{data:clients,error:clientsError},{data:packages,error:packagesError}]=await Promise.all([supabase.from("clients").select("id,full_name").eq("organization_id",membership.organization_id).eq("status","active").order("full_name"),supabase.from("package_types").select("id,name,service_count,price").eq("organization_id",membership.organization_id).eq("active",true).order("service_count")]);if(clientsError||packagesError)throw new Error("Não foi possível carregar clientes e pacotes para a venda.");return <AdminShell active="Vendas" organization={membership.organizations}><main className="clients-page"><header className="clients-header"><Link className="text-link" href="/">← Início</Link><h1>Nova venda</h1><p>A venda registra um retrato do pacote, preço e validade escolhidos hoje.</p></header><SaleForm clients={clients||[]} packages={packages||[]}/></main></AdminShell>}
