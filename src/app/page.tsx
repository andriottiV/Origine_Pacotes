"use client";

import { useState } from "react";
import { CalendarClock, ChevronRight, CircleDollarSign, ClipboardList, CreditCard, Plus, Search, Ticket } from "lucide-react";
import AdminShell, { adminNavigation } from "../components/admin-shell";
import Dialog from "../components/dialog";
import { StatusBadge } from "../components/brand";

function Metric({ label, icon: Icon }: { label: string; icon: typeof CircleDollarSign }) {
  return <article className="card metric-card"><div className="metric-icon"><Icon aria-hidden="true" size={21} /></div><div><p>{label}</p><strong aria-label="Ainda indisponível">—</strong><span>Em desenvolvimento</span></div></article>;
}

export default function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const goTo = (href: string) => window.location.assign(href);
  const results = adminNavigation.filter(item => item.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return <AdminShell active="Início"><main className="content dashboard">
    <header className="topbar"><p className="eyebrow">Visão geral da operação</p><StatusBadge tone="warning">Indicadores em desenvolvimento</StatusBadge><button className="search-button" type="button" onClick={() => setSearchOpen(true)} aria-label="Pesquisar"><Search size={19} aria-hidden="true" /><span>Pesquisar</span></button></header>
    <section className="hero"><div><h1>Seu negócio em movimento<span>.</span></h1><p>Uma visão dos seus pacotes, clientes e resultados.</p></div><div className="quick-actions"><button className="button primary" onClick={() => goTo("/vendas/nova")}><Plus size={19} aria-hidden="true" />Vender pacote</button><button className="button secondary" onClick={() => goTo("/atendimentos/novo")}><CalendarClock size={19} aria-hidden="true" />Registrar atendimento</button></div></section>
    <section className="metrics" aria-label="Indicadores do período"><Metric label="Vendas realizadas" icon={CircleDollarSign} /><Metric label="Valores recebidos" icon={CreditCard} /><Metric label="A receber" icon={CalendarClock} /><Metric label="Pacotes ativos" icon={Ticket} /></section>
    <section className="grid-two dashboard-panels">
      <article className="card panel"><div className="panel-heading"><div><p className="eyebrow">Sua operação</p><h2>Atendimentos</h2></div><button className="text-link" onClick={() => goTo("/atendimentos/novo")}>Registrar <ChevronRight size={16} aria-hidden="true" /></button></div><div className="empty"><span className="empty-icon"><ClipboardList size={26} aria-hidden="true" /></span><h3>Registro disponível</h3><p>O histórico ainda não está conectado a este painel. Consulte os pacotes com saldo ao registrar um atendimento.</p></div></article>
      <article className="card panel"><div className="panel-heading"><div><p className="eyebrow">Acompanhe de perto</p><h2>Próximos vencimentos</h2></div><CalendarClock aria-hidden="true" size={23} /></div><div className="empty"><span className="empty-icon"><CalendarClock size={26} aria-hidden="true" /></span><h3>Painel em desenvolvimento</h3><p>Os alertas de vencimento ainda não estão conectados ao dashboard. Os saldos e validades estão disponíveis no registro de atendimentos.</p></div></article>
    </section>
    <section className="card getting-started"><div><p className="eyebrow">Cada visita. Uma conexão.</p><h2>Organize o próximo encontro</h2><p>Cadastre seus clientes, configure os pacotes e acompanhe sua operação.</p></div><div className="quick-actions"><button className="button secondary" onClick={() => goTo("/clientes")}><Plus size={18} aria-hidden="true" />Cliente</button><button className="text-link" onClick={() => goTo("/pacotes")}>Configurar pacotes <ChevronRight size={17} aria-hidden="true" /></button></div></section>
    {searchOpen && <Dialog title="Pesquisar navegação" onClose={() => setSearchOpen(false)}><div className="search-dialog"><label htmlFor="search-pages">Encontre uma seção</label><input id="search-pages" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: clientes" />{results.map(({ name, label, href, icon: Icon }) => <button className="search-result" key={name} onClick={() => { goTo(href); setSearchOpen(false); }}><Icon size={18} aria-hidden="true" />{label}<ChevronRight size={16} aria-hidden="true" /></button>)}{!results.length && <p className="form-message" role="status">Nenhuma seção encontrada.</p>}</div></Dialog>}
  </main></AdminShell>;
}
