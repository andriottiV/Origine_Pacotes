import AdminShell from "../../components/admin-shell";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import { loadClientBalances } from "@/lib/package-balances";
import { CLIENT_PAGE_SIZE, pageHref, pageNumber, searchTerm } from "@/lib/pagination";
import PageNavigation from "@/components/page-navigation";
import ClientsManager from "./clients-manager";
import { connection } from "next/server";
export const instant = false;
export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await connection();
  const [{ supabase, membership }, params] = await Promise.all([requireOrganization(), searchParams]);
  const q = searchTerm(params.q); const page = pageNumber(params.page);
  let query = supabase.from("clients").select("id,full_name,phone_normalized,notes,status,created_at").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * CLIENT_PAGE_SIZE, (page + 1) * CLIENT_PAGE_SIZE);
  if (q) query = query.or('full_name.ilike.%' + q + '%,phone_normalized.ilike.%' + q + '%');
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os clientes.");
  const rows = (data || []).slice(0, CLIENT_PAGE_SIZE);
  const balances = await loadClientBalances(supabase, rows.map(c => c.id), membership.organization_id);
  const clients = rows.map(c => ({ ...c, remaining: balances.get(c.id) || 0 }));
  return <AdminShell active="Clientes" organization={membership.organizations}><main className="clients-page"><header className="clients-header"><Link className="text-link" href="/">← Início</Link><h1>Clientes</h1><p>Cadastre e acompanhe os clientes da sua barbearia. Até 50 clientes por página.</p></header><ClientsManager clients={clients} query={q}/><PageNavigation previous={page ? pageHref('/clientes', { q }, 'page', page - 1) : undefined} next={(data || []).length > CLIENT_PAGE_SIZE ? pageHref('/clientes', { q }, 'page', page + 1) : undefined} /></main></AdminShell>;
}
