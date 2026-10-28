"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "../../components/brand";
import { archiveClient, createClient, updateClient } from "./actions";
import AccessButton from "./access-button";

type Client = { id: string; full_name: string; phone_normalized: string | null; notes: string | null; status: string; created_at: string };
export default function ClientsManager({ clients, query }: { clients: Client[]; query: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Client | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    const result = await (editing ? updateClient : createClient)({}, new FormData(form));
    setSaving(false); setSuccess(Boolean(result.success)); setMessage(result.error || result.success || "");
    if (result.success) { setEditing(null); form.reset(); router.refresh(); }
  }
  async function archive(id: string) {
    const result = await archiveClient(id);
    setSuccess(Boolean(result.success)); setMessage(result.error || result.success || "");
    if (result.success) router.refresh();
  }
  return <section className="clients-manager">
    <form className="search-form" action="/clientes"><label htmlFor="q">Pesquisar por nome ou telefone</label><div><input id="q" name="q" defaultValue={query} /><button className="button secondary">Pesquisar</button></div></form>
    <div className="client-layout">
      <form key={editing?.id || "new"} className="card client-form" onSubmit={submit}>
        <h2>{editing ? "Editar cliente" : "Novo cliente"}</h2>{editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="field"><label htmlFor="fullName">Nome completo</label><input id="fullName" name="fullName" defaultValue={editing?.full_name} required /></div>
        <div className="field"><label htmlFor="phone">Telefone</label><input id="phone" name="phone" defaultValue={editing?.phone_normalized || ""} inputMode="tel" /></div>
        <div className="field"><label htmlFor="notes">Observações</label><textarea id="notes" name="notes" defaultValue={editing?.notes || ""} /></div>
        {message && <p className={`form-message ${success ? "success" : "error"}`} role="alert">{message}</p>}
        <div className="dialog-actions">{editing && <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancelar</button>}<button className="button primary" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar cliente"}</button></div>
      </form>
      <section className="card clients-list"><h2>{clients.length ? `${clients.length} cliente${clients.length === 1 ? "" : "s"}` : "Nenhum cliente encontrado"}</h2>
        {!clients.length ? <p className="empty">{query ? "Nenhum resultado para esta pesquisa." : "Os clientes cadastrados aparecerão aqui."}</p> : <div className="table-scroll" role="region" aria-label="Lista de clientes" tabIndex={0}>
          <table className="clients-table"><thead><tr><th scope="col">Cliente</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead><tbody>
            {clients.map(client => <tr key={client.id}><td><strong>{client.full_name}</strong><small>{client.phone_normalized || "Sem telefone"}</small></td><td><StatusBadge tone={client.status === "active" ? "success" : "neutral"}>{client.status === "active" ? "Ativo" : client.status === "archived" ? "Arquivado" : client.status}</StatusBadge></td><td><div className="row-actions"><button className="text-link" onClick={() => setEditing(client)}>Editar</button><AccessButton clientId={client.id} name={client.full_name} />{client.status === "active" && <button className="text-link danger" onClick={() => archive(client.id)}>Arquivar</button>}</div></td></tr>)}
          </tbody></table>
        </div>}
      </section>
    </div>
  </section>;
}
