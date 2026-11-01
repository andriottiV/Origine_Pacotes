import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type UsageHistoryRow = { id: string; client_id: string; client_package_id: string; quantity: number; occurred_at: string; reversed_at: string | null; created_by: string | null; professional_name?: string; client_name?: string; package_name?: string };
const fields = "id,client_id,client_package_id,quantity,occurred_at,reversed_at,created_by,clients!service_usages_client_same_organization_fk(full_name),client_packages!service_usages_package_same_organization_fk(package_name)";
export async function loadUsageHistory(supabase: SupabaseClient, organizationId?: string, clientId?: string, page = 0, size = 20) {
  const limit = Math.max(1, Math.min(size, 50));
  let query = supabase.from("service_usages").select(fields).order("occurred_at", { ascending: false }).order("id", { ascending: false }).range(page * limit, page * limit + limit);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (clientId) query = query.eq("client_id", clientId);
  const [{ data, error }, { data: professionals, error: professionalsError }] = await Promise.all([
    query,
    organizationId ? supabase.rpc("usage_professionals", { p_organization_id: organizationId }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (error || professionalsError) throw new Error("Não foi possível carregar o histórico de usos.");
  const names = new Map<string, string>((professionals || []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name]));
  const rows: UsageHistoryRow[] = (data || []).slice(0, limit).map(row => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const pkg = Array.isArray(row.client_packages) ? row.client_packages[0] : row.client_packages;
    return { id: row.id, client_id: row.client_id, client_package_id: row.client_package_id, quantity: row.quantity, occurred_at: row.occurred_at, reversed_at: row.reversed_at, created_by: row.created_by,
      client_name: client?.full_name, package_name: pkg?.package_name,
      professional_name: row.created_by ? names.get(row.created_by) || "Profissional da organização" : undefined };
  });
  return { rows, hasMore: (data || []).length > limit };
}
