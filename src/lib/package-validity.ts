export type ValidityOption = "month_end" | "1_month" | "2_months" | "3_months" | "6_months" | "12_months" | "custom";

/** Dates are calendar dates in São Paulo. A package remains valid through its expiry date. */
export function calculateExpiryDate(start: Date, option: ValidityOption, customDate?: Date): Date {
  const base = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  if (option === "custom") { if (!customDate) throw new Error("A data final é obrigatória."); return customDate; }
  if (option === "month_end") return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
  const months = Number(option.split("_")[0]);
  const targetMonth = base.getUTCMonth() + months;
  const year = base.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(base.getUTCDate(), lastDay)));
}
export function isPackageUsable(expiresAt: Date, today: Date): boolean {
  const expiry = Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth(), expiresAt.getUTCDate());
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return current <= expiry;
}
