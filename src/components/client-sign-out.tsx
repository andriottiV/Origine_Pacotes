"use client";
import { useRef, useState, useTransition } from "react";
import { signOutClient } from "@/app/auth/actions";
import { clearLocalPush } from "@/lib/push/browser";
export default function ClientSignOut() {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
  return <form action={signOutClient} onSubmit={event => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError("");
    startTransition(async () => {
    // Local cleanup supplements the server-side detach, including JS-disabled forms.
    try { await clearLocalPush(); } catch { /* Server detach remains mandatory. */ }
    try { await signOutClient(); }
    catch (error) { if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error; setError("Não foi possível sair com segurança. Tente novamente."); setBusy(false); lock.current = false; }
    });
  }}><button className="text-link" disabled={busy}>{busy ? "Saindo…" : "Sair"}</button>{error && <p role="alert">{error}</p>}</form>;
}
