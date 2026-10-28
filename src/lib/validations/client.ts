import { z } from "zod";
export const clientSchema = z.object({ fullName: z.string().trim().min(2, "Informe o nome completo."), phone: z.string().trim().optional(), notes: z.string().trim().max(2000, "Observações muito longas.").optional() });
export type ClientInput = z.infer<typeof clientSchema>;
export function normalizePhone(value: string | undefined) { const digits = (value || "").replace(/\D/g, ""); return digits || null; }
