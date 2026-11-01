"use client";
import { useRef, useState, useTransition } from "react";
import Dialog from "./dialog";
import { reverseAttendance } from "@/app/atendimentos/novo/actions";
import UsageList from "./usage-list";
import type { UsageHistoryRow } from "@/lib/usage-history";

export default function UsageHistory({ usages, packages = [], clients = [], canReverse = false }: {
  usages: UsageHistoryRow[]; packages?: { id: string; package_name: string }[];
  clients?: { id: string; full_name: string }[]; canReverse?: boolean;
}) {
  const [selected, setSelected] = useState<UsageHistoryRow | null>(null);
  const [message, setMessage] = useState("");
  const [saving, startTransition] = useTransition();
  const lock = useRef(false);
  function reverse() {
    if (!selected || lock.current) return;
    lock.current = true;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await reverseAttendance(selected.id);
        setMessage(result.error || result.success || "");
        if (result.success) { setSelected(null); }
      } catch { setMessage("Não foi possível confirmar o estorno. Tente novamente; o mesmo uso só será estornado uma vez."); }
      finally { lock.current = false; }
    });
  }
  return <section className="card client-form usage-history"><h2>Histórico de usos</h2>
    {message && <p className="form-message" role="status">{message}</p>}
    <UsageList usages={usages} packages={packages} clients={clients} canReverse={canReverse} action={canReverse ? usage => <button type="button" className="text-link danger" onClick={() => setSelected(usage)}>Estornar uso</button> : undefined} />
    {selected && <Dialog title="Estornar uso" onClose={() => { if (!saving) setSelected(null); }}><p>Devolver {selected.quantity} serviço{selected.quantity === 1 ? "" : "s"} ao pacote original? O lançamento será preservado e a validade continuará a mesma.</p><div className="dialog-actions"><button className="button secondary" disabled={saving} onClick={() => setSelected(null)}>Cancelar</button><button className="button primary" disabled={saving} onClick={reverse}>{saving ? "Estornando…" : "Confirmar estorno"}</button></div></Dialog>}
  </section>;
}
