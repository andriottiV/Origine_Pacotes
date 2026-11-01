import Link from "next/link";
export default function PageNavigation({ previous, next, label = "Paginação" }: { previous?: string; next?: string; label?: string }) {
  if (!previous && !next) return null;
  return <nav className="dialog-actions" aria-label={label}>{previous && <Link className="button secondary" href={previous}>Anterior</Link>}{next && <Link className="button secondary" href={next}>Próxima</Link>}</nav>;
}
