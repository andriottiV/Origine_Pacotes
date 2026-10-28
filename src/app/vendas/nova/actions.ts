"use server";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth";

export async function createSale(_: unknown, formData: FormData) {
  const { supabase } = await requireOrganization();
  const clientId=String(formData.get("clientId")||""); const packageTypeId=String(formData.get("packageTypeId")||""); const validity=String(formData.get("validity")||"");
  const custom=String(formData.get("customExpiresOn")||"") || null; const discount=Number(formData.get("discount")||0); const payment=Number(formData.get("paymentAmount")||0); const method=String(formData.get("paymentMethod")||"pix"); const idempotencyKey=String(formData.get("idempotencyKey")||"");
  if(!clientId||!packageTypeId||!["month_end","one_month","custom"].includes(validity)||!Number.isFinite(discount)||!Number.isFinite(payment)||payment<0) return {error:"Revise os dados da venda."};
  if(!idempotencyKey)return {error:"Não foi possível preparar esta venda. Recarregue a página."}; const {data,error}=await supabase.rpc("sell_client_package",{p_client_id:clientId,p_package_type_id:packageTypeId,p_validity:validity,p_custom_expires_on:custom,p_discount:discount,p_payment_amount:payment,p_payment_method:method,p_idempotency_key:idempotencyKey});
  if(error) return {error:error.message}; revalidatePath("/");revalidatePath("/atendimentos/novo"); return {success:`Venda registrada. Pacote válido até ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${data.expires_on}T12:00:00`))}.`};
}
