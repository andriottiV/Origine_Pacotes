import type { ReactNode } from "react";
import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? "wordmark wordmark-compact" : "wordmark"}><Image src={compact ? "/brand/origine-symbol-v1.webp" : "/brand/origine-logo-v1.webp"} alt="Origine Pacotes" width={compact ? 153 : 640} height={compact ? 160 : 568} loading="eager" unoptimized /></span>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
