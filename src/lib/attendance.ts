export type ServiceUsage = { client_package_id: string; quantity: number };

export function todayInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (part: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === part)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function remainingServices(packageId: string, total: number, usages: ServiceUsage[]) {
  return total - usages.filter((usage) => usage.client_package_id === packageId).reduce((sum, usage) => sum + usage.quantity, 0);
}

export function supabaseDiagnostic(error: { code?: string; message?: string; details?: string | null; hint?: string | null }) {
  return { code: error.code ?? null, message: error.message ?? "Unknown Supabase error", details: error.details ?? null, hint: error.hint ?? null };
}
