"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BarChart3, Building2, CalendarDays, CircleDollarSign, CreditCard, Home, LogOut, Menu, Settings, Ticket, UsersRound, X } from "lucide-react";
import { signOutAdmin } from "../app/auth/actions";
import { isSupabaseConfigured } from "../lib/supabase/browser";
import { Brand } from "./brand";

export const adminNavigation = [
  { name: "Início", label: "Visão geral", href: "/", icon: Home },
  { name: "Clientes", label: "Clientes", href: "/clientes", icon: UsersRound },
  { name: "Pacotes", label: "Pacotes", href: "/pacotes", icon: Ticket },
  { name: "Vendas", label: "Vendas", href: "/vendas/nova", icon: CreditCard },
  { name: "Atendimentos", label: "Atendimentos", href: "/atendimentos/novo", icon: CalendarDays },
  { name: "Financeiro", label: "Financeiro", href: "/financeiro", icon: CircleDollarSign },
  { name: "Relatórios", label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { name: "Configurações", label: "Configurações", href: "/configuracoes", icon: Settings },
] as const;

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener("origine-theme", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("origine-theme", callback); };
}
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 900px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export default function AdminShell({ children, active, organization, accountName }: {
  children: ReactNode; active: string; organization?: { name: string } | { name: string }[] | null; accountName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 900px)").matches, () => false);
  const theme = useSyncExternalStore(subscribeTheme, () => localStorage.getItem("origine-theme") || "light", () => "light");
  function setTheme(value: string) { localStorage.setItem("origine-theme", value); window.dispatchEvent(new Event("origine-theme")); }
  const [message, setMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const org = Array.isArray(organization) ? organization[0] : organization;
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { document.documentElement.dataset.theme = theme === "dark" || (theme === "system" && media.matches) ? "dark" : "light"; };
    update(); localStorage.setItem("origine-theme", theme);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  useEffect(() => {
    if (!menuOpen || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>(".close")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      if (event.key !== "Tab") return;
      const controls = sidebar.current?.querySelectorAll<HTMLElement>("a[href],button,select");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keyboard); };
  }, [menuOpen, mobile]);
  function closeMenu() { setMenuOpen(false); menuButton.current?.focus(); }
  async function logout() {
    if (!isSupabaseConfigured()) { setMessage("Supabase não está configurado neste ambiente."); return; }
    setSigningOut(true);
    try { await signOutAdmin(); } catch { setMessage("Não foi possível encerrar a sessão. Tente novamente."); setSigningOut(false); }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#workspace-main">Pular para o conteúdo</a>
    <header className="workspace-mobile"><Brand compact /><button ref={menuButton} className="icon-button" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(true)}><Menu aria-hidden="true" /></button></header>
    {menuOpen && <button className="scrim" aria-label="Fechar navegação" onClick={closeMenu} />}
    <aside ref={sidebar} id="admin-navigation" className={menuOpen ? "sidebar sidebar-open" : "sidebar"} aria-label="Navegação principal" inert={mobile && !menuOpen}>
      <div className="brand"><Link href="/" aria-label="Origine Pacotes — Início"><Brand /></Link><button className="close icon-button" type="button" onClick={closeMenu} aria-label="Fechar menu"><X aria-hidden="true" size={20} /></button></div>
      <p className="organization-label"><Building2 size={18} aria-hidden="true" /><span>{org?.name || "Área administrativa"}</span></p>
      <nav aria-label="Páginas da administração">{adminNavigation.map(({ name, label, href, icon: Icon }) => <Link href={href} key={name} className={active === name ? "nav-item active" : "nav-item"} aria-current={active === name ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon size={20} aria-hidden="true" />{label}</Link>)}</nav>
      <div className="sidebar-bottom"><label className="theme-label" htmlFor="workspace-theme">Aparência</label><select id="workspace-theme" value={theme} onChange={event => setTheme(event.target.value)}><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option></select><div className="profile"><span aria-hidden="true">{accountName ? accountName.slice(0, 2).toUpperCase() : "OP"}</span><div><strong>{accountName || "Sua conta"}</strong><small>Área administrativa</small></div></div><button className="text-link logout" disabled={signingOut} type="button" onClick={logout}><LogOut aria-hidden="true" size={16} />{signingOut ? "Saindo…" : "Sair"}</button>{message && <p role="alert" className="shell-message">{message}</p>}</div>
    </aside>
    <div id="workspace-main" className="workspace-body" tabIndex={-1} inert={mobile && menuOpen}>{children}</div>
  </div>;
}
