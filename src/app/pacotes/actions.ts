"use server";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth";

export async function savePackageType(_: unknown, formData: FormData) {
  const { supabase, membership } = await requireOrganization();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const serviceCount = Number(formData.get("serviceCount"));
  const price = Number(formData.get("price"));
  if (name.length < 2 || !Number.isInteger(serviceCount) || serviceCount < 1 || !Number.isFinite(price) || price < 0) return { error: "Informe nome, quantidade e preço válidos." };
  const values = { name, service_count: serviceCount, price, duration_months: 1 };
  const result = id ? await supabase.from("package_types").update(values).eq("id", id).eq("organization_id", membership.organization_id) : await supabase.from("package_types").insert({ ...values, organization_id: membership.organization_id });
  if (result.error) return { error: "Não foi possível salvar o pacote." };
  revalidatePath("/pacotes"); revalidatePath("/vendas/nova"); return { success: "Pacote salvo." };
}

export async function setPackageTypeActive(id: string, active: boolean) {
  const { supabase, membership } = await requireOrganization();
  const { error } = await supabase.from("package_types").update({ active }).eq("id", id).eq("organization_id", membership.organization_id);
  if (error) return { error: "Não foi possível atualizar o pacote." };
  revalidatePath("/pacotes"); revalidatePath("/vendas/nova"); return { success: active ? "Pacote ativado." : "Pacote desativado." };
}
