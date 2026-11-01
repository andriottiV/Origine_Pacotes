"use client";
import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerAttendance } from "./actions";

export type AttendancePackage = { id: string; client_id: string; package_name: string; expires_on: string; starts_on: string; payment_status: string; remaining: number };
export type AttendanceClient = { id: string; full_name: string };
export default function AttendanceForm({ packages, clients, initialClientId = "", today, emptyPackageMessage }: {
  packages: AttendancePackage[]; clients: AttendanceClient[]; initialClientId?: string; today: string; emptyPackageMessage?: string;
}) {
  const [clientId, setClientId] = useState(initialClientId);
  const [packageId, setPackageId] = useState("");
  const [quantity, setQuantity] = useState<1 | 2 | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, startTransition] = useTransition();
  const [navigating, startNavigation] = useTransition();
  const inFlight = useRef(false);
  // Freeze the request after dispatch. Retry the SAME payload/key after a lost response.
  const request = useRef<FormData | null>(null);
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();
  const eligible = packages.filter(p => p.client_id === clientId && p.remaining > 0 && p.starts_on <= today && p.expires_on >= today && ["pending", "partial", "paid"].includes(p.payment_status));
  const selected = eligible.find(p => p.id === packageId);
  const valid = Boolean(selected && quantity && quantity <= selected.remaining);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (!retrying && !valid)) return;
    if (!request.current) {
      const data = new FormData();
      data.set("clientId", clientId); data.set("packageId", packageId);
      data.set("quantity", String(quantity)); data.set("idempotencyKey", crypto.randomUUID());
      request.current = data;
    }
    inFlight.current = true;
    setMessage(""); setSuccess(false);
    startTransition(async () => {
      try {
        const result = await registerAttendance({}, request.current!);
        setSuccess(Boolean(result.success)); setMessage(result.error || result.success || "");
        request.current = null; setRetrying(false);
        if (result.success) { setQuantity(null); setPackageId(""); }
      } catch {
        setSuccess(false); setRetrying(true);
        setMessage("Não foi possível confirmar a resposta. Tente novamente para verificar o mesmo uso sem descontar duas vezes.");
      } finally { inFlight.current = false; }
    });
  }
  return <form className="card client-form" onSubmit={submit}>
    <h2>Registrar uso</h2>
    <fieldset disabled={saving || retrying || navigating} className="usage-fields">
      <div className="field"><label htmlFor="usage-client">Cliente</label><select id="usage-client" value={clientId} onChange={e => { const id = e.target.value; setClientId(id); setPackageId(""); setQuantity(null); startNavigation(() => router.push("/atendimentos/novo" + (id ? "?clientId=" + encodeURIComponent(id) : ""))); }} required>
        <option value="">Selecione o cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </select></div>
      {navigating && <p role="status">Carregando pacotes…</p>}
      {clientId && !navigating && !eligible.length && <p role="status" className="form-message">{emptyPackageMessage || "Este cliente não possui pacote válido com saldo. Pacotes vencidos, ainda não vigentes, cancelados, reembolsados ou sem saldo não podem ser utilizados."}</p>}
      {eligible.length > 0 && <div className="field"><label htmlFor="usage-package">Pacote</label><select id="usage-package" value={packageId} onChange={e => { setPackageId(e.target.value); setQuantity(null); }} required>
        <option value="">Selecione o pacote</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.package_name} · saldo {p.remaining} · validade {formatDate(p.expires_on)}</option>)}
      </select></div>}
      {selected && <><section className="selected-package"><h3>{selected.package_name}</h3><p>{selected.remaining} serviços disponíveis · Validade: {formatDate(selected.expires_on)}</p></section>
        <fieldset className="usage-fields"><legend>Quantidade de serviços</legend><div className="usage-quantities">{([1, 2] as const).map(n => <label key={n} className="usage-quantity"><input type="radio" name="quantity" value={n} checked={quantity === n} disabled={n > selected.remaining} onChange={() => setQuantity(n)} required />{n} serviço{n === 1 ? "" : "s"}</label>)}</div></fieldset>
        {quantity && <p className="selected-package" aria-live="polite">Saldo atual: {selected.remaining} · Utilizar: {quantity} · Restante: {selected.remaining - quantity}</p>}</>}
    </fieldset>
    {message && <p className={'form-message ' + (success ? 'success' : 'error')} role="alert">{message}</p>}
    <footer className="dialog-actions"><button className="button primary" disabled={saving || navigating || (!retrying && !valid)}>{saving ? "Registrando…" : retrying ? "Tentar novamente o mesmo uso" : "Confirmar uso"}</button></footer>
  </form>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value + "T12:00:00Z")); }
