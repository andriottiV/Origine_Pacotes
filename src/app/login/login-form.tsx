"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { ArrowRight, ChartNoAxesColumnIncreasing, Eye, EyeOff, Layers2, LockKeyhole, Mail, UserRound, UsersRound } from "lucide-react";
import localFont from "next/font/local";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase/browser";
import "./login.css";

const editorial = localFont({ src: "../../../public/fonts/bodoni-moda.ttf", variable: "--login-serif", display: "swap" });

function Wordmark() {
  return <span className={"origineLogin_wordmark"}><span>origine</span><small><i />PACOTES</small></span>;
}

function Tickets() {
  return <div className={"origineLogin_tickets"} aria-hidden="true">
    {[
      { number: "10", caption: "SESSÕES", note: <>ROTINA<br />CUIDADO<br />CONEXÃO<br />RESULTADOS</>, slogan: <>MAIS VISITAS<br />MAIS HISTÓRIAS</>, tone: "origineLogin_persimmon" },
      { number: "05", caption: "SESSÕES", note: <>PESSOAS<br />PLANOS<br />EVOLUÇÃO</>, slogan: <>CADA ENCONTRO<br />CONTA</>, tone: "origineLogin_cream" },
      { number: "01", caption: "SESSÃO", note: <>COMEÇOS<br />TAMBÉM<br />TRANSFORMAM</>, slogan: <>UM NOVO<br />COMEÇO</>, tone: "origineLogin_aubergine" },
    ].map(ticket => <div key={ticket.number} className={`${"origineLogin_ticket"} ${ticket.tone}`}>
      <Wordmark /><span className={"origineLogin_ticketSlogan"}>{ticket.slogan}</span>
      <span className={"origineLogin_session"}><b>{ticket.number}</b><small>{ticket.caption}</small></span>
      <span className={"origineLogin_ticketNote"}>{ticket.note}<i /></span>
    </div>)}
  </div>;
}

export default function LoginForm({ configurationError }: { configurationError?: string }) {
  const [error, setError] = useState(configurationError || "");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!isSupabaseConfigured()) return setError("Supabase não está configurado neste ambiente.");
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setLoading(true);
    try {
      const { error: authError } = await createSupabaseBrowserClient().auth.signInWithPassword({
        email: String(form.get("email") || ""), password: String(form.get("password") || ""),
      });
      if (authError) { setError("E-mail ou senha inválidos."); return; }
      window.location.assign("/");
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return <main className={`${"origineLogin_page"} ${editorial.variable}`}>
    <section className={"origineLogin_editorial"} aria-label="Origine Pacotes: cada visita, uma conexão">
      <div className={"origineLogin_orbit"} aria-hidden="true" />
      <h2 className={"origineLogin_headline"}>Cada visita.<br /><span>Uma conexão.</span></h2>
      <p className={"origineLogin_description"}>Pacotes, clientes e recorrência<br /> em um só lugar. Mais organização para o seu negócio, mais valor para cada relacionamento.</p>
      <div className={"origineLogin_benefits"}>
        <span className={"origineLogin_yellowDash"} aria-hidden="true" />
        <p><UsersRound aria-hidden="true" /><span>Gerencie<br />seus clientes</span></p>
        <p><Layers2 aria-hidden="true" /><span>Crie e venda<br />pacotes de forma simples</span></p>
        <p><ChartNoAxesColumnIncreasing aria-hidden="true" /><span>Acompanhe sua<br />recorrência e resultados</span></p>
      </div>
      <Tickets />
      <p className={"origineLogin_signature"}>Negócios<br /><span>que voltam</span><br />mais longe.</p>
      <span className={"origineLogin_editorialFootnote"} aria-hidden="true">CLIENTES<br />PACOTES<br />RECORRÊNCIA<br />CRESCIMENTO</span>
    </section>

    <section className={"origineLogin_login"} aria-labelledby="login-title">
      <p className={"origineLogin_motto"} aria-hidden="true">ORGANIZAÇÃO<br />HOJE,<br />CLIENTES<br />SEMPRE.</p>
      <div className={"origineLogin_loginContent"}>
        <div className={"origineLogin_brand"} aria-label="Origine Pacotes"><Wordmark /></div>
        <p className={"origineLogin_mobileEditorial"}>Cada visita. <span>Uma conexão.</span></p>
        <header className={"origineLogin_welcome"}>
          <h1 id="login-title">Bem-vindo de volta</h1>
          <p>Acesse sua conta para continuar gerenciando seus pacotes e clientes.</p>
        </header>
        <form onSubmit={submit} aria-busy={loading}>
          <div className={"origineLogin_field"}>
            <label htmlFor="login-email">E-mail</label>
            <div className={"origineLogin_inputWrap"}><Mail aria-hidden="true" /><input id="login-email" name="email" type="email" autoComplete="email" placeholder="seu@email.com" required aria-describedby={error ? "login-error" : undefined} /></div>
          </div>
          <div className={"origineLogin_field"}>
            <label htmlFor="login-password">Senha</label>
            <div className={"origineLogin_inputWrap"}><LockKeyhole aria-hidden="true" /><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" required aria-describedby={error ? "login-error" : undefined} /><button className={"origineLogin_visibility"} type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>{showPassword ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button></div>
          </div>
          <div className={"origineLogin_feedback"} id="login-error" role="alert">{error}</div>
          <button type="submit" className={"origineLogin_submit"} disabled={loading}><span>{loading ? "Entrando…" : "Entrar"}</span><ArrowRight aria-hidden="true" /></button>
          <span className={"origineLogin_srOnly"} role="status">{loading ? "Entrando. Aguarde." : ""}</span>
        </form>
        <div className={"origineLogin_separator"}><span>ou</span></div>
        <Link className={"origineLogin_clientLink"} href="/cliente/login"><UserRound aria-hidden="true" /><span>Acessar como cliente</span><ArrowRight aria-hidden="true" /></Link>
        <footer className={"origineLogin_footer"}>Origine Pacotes <span>—</span> Gestão simples para relacionamentos duradouros.</footer>
      </div>
    </section>
  </main>;
}
