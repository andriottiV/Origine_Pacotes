import type { ReactNode } from "react";
import { exitAuthFlow } from "../app/auth/flow-actions";
import { Brand } from "./brand";

export default function AuthLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return <main className="auth-page auth-flow-page"><section className="auth-card auth-flow-card"><Brand /><p className="eyebrow">Cada visita. Uma conexão.</p><h1>{title}</h1>{intro && <p className="auth-copy">{intro}</p>}{children}<footer className="auth-flow-footer"><form action={exitAuthFlow}><button className="text-link" type="submit">Voltar ao login</button></form><span>Origine Pacotes</span></footer></section></main>;
}
