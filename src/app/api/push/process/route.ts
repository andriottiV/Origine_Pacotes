import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizedCron } from "@/lib/push/cron";
import { processPushBatch } from "@/lib/push/worker";
import { privateJson } from "@/lib/push/server";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return privateJson({ error: "Não autorizado." }, 401);
  try {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    if (hour >= 9) { const { error } = await createSupabaseAdminClient().rpc("queue_expiring_push_events", { p_limit: 200 }); if (error) throw new Error("expiry_queue_failed"); }
    return privateJson(await processPushBatch(20));
  }
  catch { return privateJson({ error: "Processamento indisponível; tarefas persistidas para nova tentativa." }, 503); }
}
export const POST = GET;
