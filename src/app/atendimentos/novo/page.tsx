import AdminShell from "../../../components/admin-shell";
import Link from "next/link";
import { connection } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { remainingServices, supabaseDiagnostic, todayInSaoPaulo } from "@/lib/attendance";
import AttendanceForm from "./attendance-form";

export const instant = false;
type PackageRow = { id:string; package_name:string; total_services:number; expires_on:string; clients:{full_name:string}|{full_name:string}[]|null };

async function loadActivePackages() {
  const { supabase, membership } = await requireOrganization();
  const { data: rows, error: packagesError } = await supabase
    .from("client_packages")
    .select("id, package_name, total_services, expires_on, clients!client_packages_client_same_organization_fk(full_name)")
    .eq("organization_id", membership.organization_id)
    .gte("expires_on", todayInSaoPaulo())
    .in("payment_status", ["pending", "partial", "paid"]);
  if (packagesError) throw packagesError;
  const packageIds = (rows ?? []).map((row) => row.id);
  if (!packageIds.length) return [];
  const { data: usages, error: usagesError } = await supabase
    .from("service_usages")
    .select("client_package_id, quantity")
    .in("client_package_id", packageIds)
    .is("reversed_at", null);
  if (usagesError) throw usagesError;
  return (rows as PackageRow[]).map((row) => ({
    ...row,
    clients: Array.isArray(row.clients) ? row.clients[0] ?? null : row.clients,
    remaining: remainingServices(row.id, row.total_services, usages ?? []),
  })).filter((row) => row.remaining > 0);
}

export default async function AttendancePage() {
  await connection();
  let packages;
  try { packages = await loadActivePackages(); }
  catch (error) {
    if (process.env.NODE_ENV === "development" && error && typeof error === "object") console.error("attendance-packages-query", supabaseDiagnostic(error as {code?:string;message?:string;details?:string|null;hint?:string|null}));
    throw new Error("Não foi possível carregar os pacotes para atendimento. Atualize a página; se persistir, contate o administrador.");
  }
  return <AdminShell active="Atendimentos"><main className="clients-page"><header className="clients-header"><Link className="text-link" href="/">← Início</Link><h1>Novo atendimento</h1><p>O saldo é recalculado e validado pelo banco no instante do registro.</p></header><AttendanceForm packages={packages}/></main></AdminShell>;
}
