import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { privateJson, pushIdentity, sameOrigin, smallJson } from "@/lib/push/server";
const schema = z.object({ used: z.boolean(), reversed: z.boolean(), low_balance: z.boolean(), expiring: z.boolean() }).strict();
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Origem inválida." }, 403);
  try {
    const identity = await pushIdentity(); if (!identity) return privateJson({ error: "Entre no portal para alterar preferências." }, 401);
    const result = schema.safeParse(await smallJson(request)); if (!result.success) return privateJson({ error: "Preferências inválidas." }, 400);
    const { error } = await createSupabaseAdminClient().rpc("set_push_preferences", { p_identity_id: identity.id, p_preferences: result.data });
    if (error) throw new Error("preferences_failed");
    return privateJson({ success: true });
  } catch { return privateJson({ error: "Não foi possível salvar suas preferências." }, 503); }
}
