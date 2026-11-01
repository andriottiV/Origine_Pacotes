"use server";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth";
import { z } from "zod";
import { timed } from "@/lib/performance";

function refreshBalances() {
  for (const path of ["/", "/clientes", "/atendimentos/novo", "/cliente", "/relatorios"]) revalidatePath(path);
}

export async function registerAttendance(_: unknown, formData: FormData) {
  const { supabase, membership } = await requireOrganization();
  const parsed = z.object({
    packageId: z.string().uuid(), clientId: z.string().uuid(),
    quantity: z.enum(["1", "2"]), idempotencyKey: z.string().uuid(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Selecione o cliente, o pacote e a quantidade de 1 ou 2 serviços." };
  const input = parsed.data;
  const { data, error } = await timed("usage.register.rpc", () => supabase.rpc("register_service_usage_for_client", {
    p_package_id: input.packageId, p_client_id: input.clientId,
    p_organization_id: membership.organization_id,
    p_quantity: Number(input.quantity), p_idempotency_key: input.idempotencyKey,
  }));
  if (error) return { error: error.message };
  refreshBalances();
  return { success: `${data.quantity} serviço${data.quantity === 1 ? "" : "s"} utilizado${data.quantity === 1 ? "" : "s"}. Saldo atualizado.` };
}

export async function reverseAttendance(id: string) {
  const { supabase, membership } = await requireOrganization();
  if (!z.string().uuid().safeParse(id).success) return { error: "Uso inválido." };
  const { error } = await timed("usage.reverse.rpc", () => supabase.rpc("reverse_service_usage", { p_usage_id: id, p_organization_id: membership.organization_id }));
  if (error) return { error: error.message };
  refreshBalances();
  return { success: "Uso estornado. Saldo atualizado e validade original preservada." };
}
