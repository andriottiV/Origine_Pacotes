// Safe diagnostic projection. Never include environment values or private keys.
export const pushConfigurationMessages = {
  push_disabled: "PUSH_ENABLED deve ser exatamente true, sem aspas ou espaços.",
  public_key_missing_build: "NEXT_PUBLIC_VAPID_PUBLIC_KEY não está disponível no build. Configure-a em Production e gere um novo build.",
  public_key_invalid_build: "NEXT_PUBLIC_VAPID_PUBLIC_KEY está inválida no build. Confira a chave pública existente e gere um novo build.",
  public_key_build_mismatch: "NEXT_PUBLIC_VAPID_PUBLIC_KEY do build difere da configuração atual. Publique um novo build com o mesmo par VAPID existente.",
  private_key_missing: "VAPID_PRIVATE_KEY não está configurada no servidor.",
  private_key_invalid: "VAPID_PRIVATE_KEY está inválida no servidor. Confira o valor existente, sem espaços ou aspas.",
  key_pair_mismatch: "VAPID_PRIVATE_KEY não corresponde à chave pública do build. Configure o par existente correto; não gere outro par.",
  subject_missing: "VAPID_SUBJECT não está configurada no servidor.",
  subject_invalid: "VAPID_SUBJECT deve ser um contato mailto: ou uma URL HTTPS válida.",
  admin_key_missing: "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.",
  site_url_missing: "SITE_URL não está configurada no servidor.",
  site_url_invalid: "SITE_URL deve ser a origem da aplicação, sem caminho, consulta ou fragmento; use HTTPS na produção.",
} as const;
export type PushConfigurationIssue = keyof typeof pushConfigurationMessages;
export type PushConfiguration = {
  version: 1; configured: boolean; issues: PushConfigurationIssue[];
  checks: { enabled: boolean; publicKeyInBuild: boolean; publicKeyAtRuntime: boolean; privateKeyPresent: boolean; subjectPresent: boolean; keyPairMatches: boolean | null; adminKeyPresent: boolean; siteUrlPresent: boolean };
};
export function isPushConfiguration(value: unknown): value is PushConfiguration {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<PushConfiguration>;
  return config.version === 1 && typeof config.configured === "boolean" && Array.isArray(config.issues)
    && config.issues.every(issue => typeof issue === "string" && Object.hasOwn(pushConfigurationMessages, issue))
    && config.configured === (config.issues.length === 0);
}
