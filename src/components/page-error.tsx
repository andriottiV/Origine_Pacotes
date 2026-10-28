"use client";
import AdminShell from "./admin-shell";
import { Brand } from "./brand";

export default function PageError({ active, reset, portal = false }: { active?: string; reset: () => void; portal?: boolean }) {
  const content = <main className="clients-page"><section className="card client-form"><p className="eyebrow">Falha no carregamento</p><h1>Não foi possível abrir esta página</h1><p className="form-intro">Verifique sua conexão e tente novamente. Se o problema continuar, contate o administrador.</p><button className="button primary" onClick={reset}>Tentar novamente</button></section></main>;
  return portal ? <><div className="portal-error-brand"><Brand /></div>{content}</> : <AdminShell active={active || ""}>{content}</AdminShell>;
}
