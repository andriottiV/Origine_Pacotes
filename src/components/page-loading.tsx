import AdminShell from "./admin-shell";

export default function PageLoading({ active }: { active: string }) {
  return <AdminShell active={active}><main className="clients-page"><p className="eyebrow">{active}</p><h1>Carregando</h1><div className="card loading-panel" role="status">Carregando os dados da página…</div></main></AdminShell>;
}
