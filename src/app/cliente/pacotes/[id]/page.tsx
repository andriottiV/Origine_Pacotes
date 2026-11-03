import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pushIdentity } from "@/lib/push/server";
import { loadUsageHistory } from "@/lib/usage-history";
import { pageNumber, pageHref } from "@/lib/pagination";
import { todayInSaoPaulo } from "@/lib/attendance";
import PackageTicket from "@/components/package-ticket";
import UsageHistory from "@/components/usage-history-view";
import PageNavigation from "@/components/page-navigation";
import ClientSignOut from "@/components/client-sign-out";
export const instant = false;
export default async function ClientPackage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  await connection(); const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServerClient(); const identity = await pushIdentity(supabase);
  if (!identity) redirect('/cliente/login?next=' + encodeURIComponent('/cliente/pacotes/' + id));
  const page = pageNumber((await searchParams).page);
  const [{ data, error }, history] = await Promise.all([
    supabase.rpc("portal_package_balance", { p_package_id: id }),
    loadUsageHistory(supabase, undefined, identity.client_id, page, 20, id),
  ]);
  if (error) throw new Error("Não foi possível carregar o pacote.");
  const pkg = data?.[0];
  if (!pkg || pkg.client_id !== identity.client_id) notFound();
  const path = '/cliente/pacotes/' + id;
  return <main className="clients-page client-portal"><header className="clients-header"><Link className="text-link" href="/cliente">← Meus pacotes</Link><h1>Seu pacote</h1><ClientSignOut /></header>
    <PackageTicket name={pkg.package_name} balances={[{ label: "Serviços", total: pkg.total_services, remaining: Number(pkg.remaining) }]} expiresOn={pkg.expires_on} status={pkg.expires_on < todayInSaoPaulo() ? "Vencido" : "Pacote contratado"} />
    <UsageHistory usages={history.rows} /><PageNavigation previous={page ? pageHref(path, {}, 'page', page - 1) : undefined} next={history.hasMore ? pageHref(path, {}, 'page', page + 1) : undefined} />
  </main>;
}
