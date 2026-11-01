import type { ReactNode } from "react";
import { usageDate } from "@/lib/usage-format";
import type { UsageHistoryRow } from "@/lib/usage-history";
export type UsageListProps = { usages: UsageHistoryRow[]; packages?: { id: string; package_name: string }[]; clients?: { id: string; full_name: string }[]; canReverse?: boolean };
export default function UsageList({ usages, packages = [], clients = [], canReverse = false, action }: UsageListProps & { action?: (usage: UsageHistoryRow) => ReactNode }) {
  return <>{!usages.length && <p>Nenhum uso registrado.</p>}<ul className="usage-list">{usages.map(usage => <li key={usage.id}>
    <p><strong>{usageDate(usage.occurred_at)} — {usage.quantity} serviço{usage.quantity === 1 ? " utilizado" : "s utilizados"}</strong></p>
    <p>{usage.client_name || clients.find(c => c.id === usage.client_id)?.full_name} · {usage.package_name || packages.find(p => p.id === usage.client_package_id)?.package_name || "Pacote"}</p>
    {canReverse && usage.created_by && <small>Responsável: {usage.professional_name || "Profissional da organização"}</small>}
    {usage.reversed_at ? <p>Estornado em {usageDate(usage.reversed_at)}</p> : action?.(usage)}
  </li>)}</ul></>;
}
