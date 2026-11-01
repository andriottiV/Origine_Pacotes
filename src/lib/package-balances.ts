import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type PackageBalance = { id: string; client_id: string; package_name: string; total_services: number; starts_on: string; expires_on: string; payment_status: string; remaining: number };
export async function loadPackageBalances(supabase: SupabaseClient, clientId: string, organizationId: string, usableOnly = false, page = 0) {
  const { data, error } = await supabase.rpc("client_package_balances", {
    p_client_id: clientId, p_organization_id: organizationId, p_usable_only: usableOnly,
    p_offset: page * 20, p_limit: 21,
  });
  if (error) throw new Error("Não foi possível carregar os saldos dos pacotes.");
  return { rows: (data || []).slice(0, 20).map((p: PackageBalance) => ({ ...p, remaining: Number(p.remaining) })) as PackageBalance[], hasMore: (data || []).length > 20 };
}
export async function loadClientBalances(supabase: SupabaseClient, clientIds: string[], organizationId: string) {
  if (!clientIds.length) return new Map<string, number>();
  const { data, error } = await supabase.rpc("client_service_balances", { p_client_ids: clientIds, p_organization_id: organizationId });
  if (error) throw new Error("Não foi possível carregar os saldos dos clientes.");
  return new Map<string, number>((data || []).map((p: { client_id: string; remaining: number }) => [p.client_id, Number(p.remaining)]));
}
