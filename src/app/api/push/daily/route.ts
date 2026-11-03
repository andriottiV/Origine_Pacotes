import { authorizedCron } from "@/lib/push/cron";
import { processPushBatch } from "@/lib/push/worker";
import { privateJson } from "@/lib/push/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return privateJson({ error: "Não autorizado." }, 401);
  try {
    const admin = createSupabaseAdminClient(); let queued = 0; let complete = false;
    for (let i = 0; i < 5; i++) {
      const { data, error } = await admin.rpc("queue_expiring_push_events", { p_limit: 200 });
      if (error) throw new Error("expiry_queue_failed");
      queued += Number(data);
      if (Number(data) < 200) { complete = true; break; }
    }
    return privateJson({ queued, complete, ...await processPushBatch(20) });
  } catch { return privateJson({ error: "Agendamento indisponível. Reexecute com a mesma autenticação." }, 503); }
}
export const POST = GET;
