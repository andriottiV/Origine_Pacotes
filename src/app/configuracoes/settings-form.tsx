"use client";
import { FormEvent, useState } from "react";
import { saveSettings } from "./actions";

export default function SettingsForm({ org, profile, email }: { org: Record<string, unknown>; profile: string; email: string }) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const result = await saveSettings({}, new FormData(event.currentTarget));
    setSaving(false); setSuccess(Boolean(result.success)); setMessage(result.error || result.success || "");
  }
  return <form onSubmit={submit} className="card client-form">
    <fieldset className="settings-section"><legend>Dados da operação</legend><div className="settings-grid">
      <div className="field"><label htmlFor="settings-org">Nome da barbearia</label><input id="settings-org" name="orgName" defaultValue={String(org.name || "")} required /></div>
      <div className="field"><label htmlFor="settings-phone">Telefone comercial</label><input id="settings-phone" name="phone" type="tel" defaultValue={String(org.business_phone || "")} /></div>
      <div className="field"><label htmlFor="settings-whatsapp">WhatsApp</label><input id="settings-whatsapp" name="whatsapp" type="tel" defaultValue={String(org.whatsapp || "")} /></div>
      <div className="field"><label htmlFor="settings-address">Endereço</label><input id="settings-address" name="address" defaultValue={String(org.address || "")} /></div>
    </div><div className="field"><label htmlFor="settings-description">Descrição</label><textarea id="settings-description" name="description" defaultValue={String(org.description || "")} /></div></fieldset>
    <fieldset className="settings-section"><legend>Seu perfil</legend><div className="settings-grid">
      <div className="field"><label htmlFor="settings-name">Seu nome</label><input id="settings-name" name="name" defaultValue={profile} required /></div>
      <div className="field"><label htmlFor="settings-email">E-mail</label><input id="settings-email" value={email} disabled /></div>
    </div></fieldset>
    <fieldset className="settings-section"><legend>Preferências dos pacotes</legend><div className="settings-grid">
      <div className="field"><label htmlFor="settings-validity">Validade padrão</label><select id="settings-validity" name="validity" defaultValue={String(org.default_validity || "month_end")}><option value="month_end">Fim do mês</option><option value="one_month">Um mês</option></select></div>
      <div className="field"><label htmlFor="settings-alert">Alerta de vencimento</label><select id="settings-alert" name="alertDays" defaultValue={String(org.expiry_alert_days || 5)}>{[3, 5, 7, 10].map(days => <option value={days} key={days}>{days} dias</option>)}</select></div>
    </div></fieldset>
    {message && <p role="alert" className={`form-message ${success ? "success" : "error"}`}>{message}</p>}
    <div className="dialog-actions"><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button></div>
  </form>;
}
