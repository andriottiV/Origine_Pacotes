import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPackageBalances } from "@/lib/package-balances";
import { pageHref, pageNumber } from "@/lib/pagination";
import PageNavigation from "@/components/page-navigation";
import UsageHistory from "@/components/usage-history-view";
import { loadUsageHistory } from "@/lib/usage-history";
import { todayInSaoPaulo } from "@/lib/attendance";
import { signOutClient } from "../auth/actions";
import ClientSecurityForm from "./security-form";
import PackageTicket from "../../components/package-ticket";
import { Brand } from "../../components/brand";

export const instant = false;
export default async function ClientPortal({ searchParams }: { searchParams: Promise<{ packagePage?: string; historyPage?: string }> }) {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/cliente/login");
  const { data: identity, error: identityError } = await supabase.from("client_identities").select("client_id,organization_id,clients!client_identities_client_id_fkey(full_name),organizations(name)").eq("user_id", user.id).maybeSingle();
  if (identityError) {
    if (process.env.NODE_ENV === "development") console.error("client-portal-identity", { code: identityError.code, message: identityError.message });
    throw new Error("Não foi possível abrir o portal do cliente. Tente novamente.");
  }
  if (!identity) redirect("/cliente/login");
  const params = await searchParams;
  const packagePage = pageNumber(params.packagePage); const historyPage = pageNumber(params.historyPage);
  const [packageResult, history] = await Promise.all([
    loadPackageBalances(supabase, identity.client_id, identity.organization_id, false, packagePage),
    loadUsageHistory(supabase, undefined, identity.client_id, historyPage),
  ]);
  const packages = packageResult.rows;
  const client = Array.isArray(identity.clients) ? identity.clients[0] : identity.clients;
  const org = Array.isArray(identity.organizations) ? identity.organizations[0] : identity.organizations;
  return <main className="clients-page client-portal">
    <div className="portal-brand"><Brand /></div>
    <header className="clients-header"><p className="eyebrow">{org?.name}</p><h1>Olá, {client?.full_name}</h1><p>Consulte seus pacotes e saldo disponível.</p><form action={signOutClient}><button className="text-link">Sair</button></form></header>
    <section className="portal-packages" aria-label="Seus pacotes">
      {(packages || []).map((p, index) => <PackageTicket key={p.id} name={p.package_name} balances={[{ label: "Serviços", total: p.total_services, remaining: p.remaining }]} expiresOn={p.expires_on} status={p.expires_on < todayInSaoPaulo() ? "Vencido" : p.payment_status === "paid" ? "Quitado" : p.payment_status === "partial" ? "Pagamento parcial" : p.payment_status === "pending" ? "Pagamento pendente" : p.payment_status} tone={index % 3 === 0 ? "persimmon" : index % 3 === 1 ? "paper" : "aubergine"} />)}
      {!packages?.length && <p className="empty">{packagePage ? "Não há pacotes nesta página. Volte à página anterior." : "Você ainda não possui pacotes cadastrados."}</p>}
    </section>
    <PageNavigation label="Seus pacotes" previous={packagePage ? pageHref('/cliente', params, 'packagePage', packagePage - 1) : undefined} next={packageResult.hasMore ? pageHref('/cliente', params, 'packagePage', packagePage + 1) : undefined} />
    <UsageHistory usages={history.rows} />
    <PageNavigation label="Seus usos" previous={historyPage ? pageHref('/cliente', params, 'historyPage', historyPage - 1) : undefined} next={history.hasMore ? pageHref('/cliente', params, 'historyPage', historyPage + 1) : undefined} />
    <ClientSecurityForm />
  </main>;
}
