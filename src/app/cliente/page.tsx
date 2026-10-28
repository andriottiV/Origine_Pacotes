import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { remainingServices } from "@/lib/attendance";
import { signOutClient } from "../auth/actions";
import ClientSecurityForm from "./security-form";
import PackageTicket from "../../components/package-ticket";
import { Brand } from "../../components/brand";

export const instant = false;
export default async function ClientPortal() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/cliente/login");
  const { data: identity, error: identityError } = await supabase.from("client_identities").select("client_id,clients!client_identities_client_id_fkey(full_name),organizations(name)").eq("user_id", user.id).maybeSingle();
  if (identityError) {
    if (process.env.NODE_ENV === "development") console.error("client-portal-identity", { code: identityError.code, message: identityError.message });
    throw new Error("Não foi possível abrir o portal do cliente. Tente novamente.");
  }
  if (!identity) redirect("/cliente/login");
  const { data: packages, error: packagesError } = await supabase.from("client_packages").select("id,package_name,total_services,expires_on,payment_status").eq("client_id", identity.client_id).order("created_at", { ascending: false });
  if (packagesError) throw new Error("Não foi possível carregar os pacotes.");
  const ids = (packages || []).map(p => p.id);
  const { data: usages, error: usagesError } = ids.length ? await supabase.from("service_usages").select("client_package_id,quantity").in("client_package_id", ids).is("reversed_at", null) : { data: [], error: null };
  if (usagesError) throw new Error("Não foi possível carregar os atendimentos.");
  const client = Array.isArray(identity.clients) ? identity.clients[0] : identity.clients;
  const org = Array.isArray(identity.organizations) ? identity.organizations[0] : identity.organizations;
  return <main className="clients-page client-portal">
    <div className="portal-brand"><Brand /></div>
    <header className="clients-header"><p className="eyebrow">{org?.name}</p><h1>Olá, {client?.full_name}</h1><p>Consulte seus pacotes e saldo disponível.</p><form action={signOutClient}><button className="text-link">Sair</button></form></header>
    <section className="portal-packages" aria-label="Seus pacotes">
      {(packages || []).map((p, index) => <PackageTicket key={p.id} name={p.package_name} balances={[{ label: "Serviços", total: p.total_services, remaining: remainingServices(p.id, p.total_services, usages || []) }]} expiresOn={p.expires_on} status={p.payment_status === "paid" ? "Quitado" : p.payment_status === "partial" ? "Pagamento parcial" : p.payment_status === "pending" ? "Pagamento pendente" : p.payment_status} tone={index % 3 === 0 ? "persimmon" : index % 3 === 1 ? "paper" : "aubergine"} />)}
      {!packages?.length && <p className="empty">Você ainda não possui pacotes cadastrados.</p>}
    </section>
    <ClientSecurityForm />
  </main>;
}
