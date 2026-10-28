import type { ReactNode } from "react";
import { Scissors } from "lucide-react";
import { StatusBadge } from "./brand";

type Balance = { label: string; total: number; remaining: number };
export default function PackageTicket({ name, client, balances, expiresOn, status, tone = "paper", children }: {
  name: string; client?: string; balances: Balance[]; expiresOn?: string | null;
  status: ReactNode; tone?: "persimmon" | "paper" | "aubergine"; children?: ReactNode;
}) {
  return <article className={`package-ticket ticket-${tone}`}>
    <div className="ticket-main"><header><div><h2>{name}</h2>{client && <p>{client}</p>}</div><StatusBadge>{status}</StatusBadge></header>
      {balances.map(balance => <div className="ticket-balance" key={balance.label}><div><strong>{String(balance.remaining).padStart(2, "0")}</strong><span>{balance.label}<br />restantes</span></div><p>{balance.total} contratados · {balance.total - balance.remaining} utilizados</p></div>)}
      {expiresOn && <p className="ticket-validity">Validade: <time dateTime={expiresOn}>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${expiresOn}T12:00:00`))}</time></p>}
      {children && <footer className="ticket-actions">{children}</footer>}
    </div><div className="ticket-stub" aria-hidden="true"><Scissors size={28} strokeWidth={1.3} /><span>ORIGINE · PACOTES</span></div>
  </article>;
}
