import AdminShell from "../../../components/admin-shell";
import Link from "next/link";
import Form from "next/form";
import { connection } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth";
import { todayInSaoPaulo } from "@/lib/attendance";
import { loadUsageHistory } from "@/lib/usage-history";
import { loadPackageBalances } from "@/lib/package-balances";
import { pageHref, pageNumber, searchTerm } from "@/lib/pagination";
import PageNavigation from "@/components/page-navigation";
import UsageHistory from "@/components/usage-history";
import AttendanceForm from "./attendance-form";

export const instant = false;
type Params = { clientId?: string; q?: string; clientPage?: string; packagePage?: string; historyPage?: string };
export default async function AttendancePage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const [{ supabase, membership }, params] = await Promise.all([requireOrganization(), searchParams]);
  const q = searchTerm(params.q); const clientPage = pageNumber(params.clientPage);
  const packagePage = pageNumber(params.packagePage); const historyPage = pageNumber(params.historyPage);
  const clientId = z.string().uuid().safeParse(params.clientId).success ? params.clientId : undefined;
  let query = supabase.from("clients").select("id,full_name").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(clientPage * 20, clientPage * 20 + 20);
  if (q) query = query.or('full_name.ilike.%' + q + '%,phone_normalized.ilike.%' + q + '%');
  const [{ data: clientRows, error: clientsError }, selectedClient, packages, history] = await Promise.all([
    query,
    clientId ? supabase.from("clients").select("id,full_name").eq("organization_id", membership.organization_id).eq("id", clientId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    clientId ? loadPackageBalances(supabase, clientId, membership.organization_id, true, packagePage) : Promise.resolve({ rows: [], hasMore: false }),
    loadUsageHistory(supabase, membership.organization_id, clientId, historyPage),
  ]);
  if (clientsError || selectedClient.error) throw new Error("Não foi possível carregar os clientes para registrar uso.");
  const clients = (clientRows || []).slice(0, 20);
  const selected = selectedClient.data;
  if (selected && !clients.some(c => c.id === selected.id)) clients.unshift(selected);
  const initialClientId = selectedClient.data?.id || "";
  return <AdminShell active="Atendimentos" organization={membership.organizations}><main className="clients-page"><header className="clients-header"><Link className="text-link" href="/clientes">← Clientes</Link><h1>Registrar uso</h1><p>Selecione o cliente, o pacote e utilize 1 ou 2 serviços.</p></header>
    <Form action="/atendimentos/novo" className="search-form"><label htmlFor="find-client">Pesquisar cliente por nome ou telefone</label><div><input id="find-client" name="q" defaultValue={q} />{initialClientId && <input type="hidden" name="clientId" value={initialClientId} />}<button className="button secondary">Pesquisar</button></div></Form>
    <PageNavigation label="Resultados de clientes" previous={clientPage ? pageHref('/atendimentos/novo', params, 'clientPage', clientPage - 1) : undefined} next={(clientRows || []).length > 20 ? pageHref('/atendimentos/novo', params, 'clientPage', clientPage + 1) : undefined} />
    <AttendanceForm key={initialClientId} packages={packages.rows} clients={clients} initialClientId={initialClientId} today={todayInSaoPaulo()} emptyPackageMessage={packagePage ? "Não há pacotes disponíveis nesta página. Volte à página anterior." : undefined} />
    <PageNavigation label="Pacotes do cliente" previous={packagePage ? pageHref('/atendimentos/novo', params, 'packagePage', packagePage - 1) : undefined} next={packages.hasMore ? pageHref('/atendimentos/novo', params, 'packagePage', packagePage + 1) : undefined} />
    <UsageHistory usages={history.rows} canReverse />
    <PageNavigation label="Histórico de usos" previous={historyPage ? pageHref('/atendimentos/novo', params, 'historyPage', historyPage - 1) : undefined} next={history.hasMore ? pageHref('/atendimentos/novo', params, 'historyPage', historyPage + 1) : undefined} />
  </main></AdminShell>;
}
