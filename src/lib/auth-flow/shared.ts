import { z } from "zod";

export const passwordHint = "Use ao menos 10 caracteres, com letras e números. Prefira uma senha longa e exclusiva.";
export const passwordSchema = z.string().min(10, "Use ao menos 10 caracteres na senha.").regex(/[a-z]/i, "Inclua uma letra na senha.").regex(/\d/, "Inclua um número na senha.");
export const passwordPairSchema = z.object({ password: passwordSchema, confirmation: z.string() })
  .refine(value => value.password === value.confirmation, { path: ["confirmation"], message: "As senhas não coincidem." });
export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(160, "Use até 160 caracteres no nome."),
  businessName: z.string().trim().min(2, "Informe o nome do negócio.").max(160, "Use até 160 caracteres no nome do negócio."),
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  password: passwordSchema, confirmation: z.string(),
}).refine(value => value.password === value.confirmation, { path: ["confirmation"], message: "As senhas não coincidem." });
export const emailSchema = z.string().trim().email("Informe um e-mail válido.").max(254);

export type FlowState = { error?: string; success?: string; fieldErrors?: Record<string, string>; destination?: string; invalidLink?: boolean };
export const recoveryMessage = "Se houver uma conta com esse e-mail, você receberá um link para redefinir sua senha.";
export const signupMessage = "Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Verifique a caixa de entrada e o spam. Abra o link neste mesmo navegador. Se já possui uma conta, entre ou recupere sua senha.";

export function authFailure(error: { code?: string; status?: number; name?: string }): string {
  if (error.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code || "")) return "Limite de envio atingido. Aguarde alguns minutos antes de tentar novamente.";
  if (error.code === "weak_password") return "A senha não atende à política de segurança do projeto. Use uma senha mais longa, com letras maiúsculas, minúsculas, números e símbolos; evite senhas conhecidas.";
  if (error.code === "same_password") return "Escolha uma senha diferente da senha atual.";
  if (error.code === "signup_disabled") return "O cadastro está temporariamente indisponível.";
  if (error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500) return "Não foi possível conectar ao serviço. Tente novamente em instantes.";
  return "Não foi possível concluir a solicitação. Tente novamente.";
}

export function recoveryClaims(claims: Record<string, unknown> | null | undefined) {
  return Array.isArray(claims?.amr) && claims.amr.some(item => item && typeof item === "object" && item.method === "recovery");
}
