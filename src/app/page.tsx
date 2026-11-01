import { connection } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { loadUsageHistory } from "@/lib/usage-history";
import UsageHistory from "@/components/usage-history";
import Dashboard from "./dashboard";
export const instant = false;
export default async function HomePage() {
  await connection();
  const { supabase, membership } = await requireOrganization();
  const history = await loadUsageHistory(supabase, membership.organization_id, undefined, 0, 10);
  return <Dashboard usageHistory={<UsageHistory usages={history.rows} canReverse />} />;
}
