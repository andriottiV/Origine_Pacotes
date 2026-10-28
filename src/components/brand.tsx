import type { ReactNode } from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? "wordmark wordmark-compact" : "wordmark"} aria-label="Origine Pacotes"><span>origine</span><small><i aria-hidden="true" />PACOTES</small></span>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
