"use client";
import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import PasswordField from "./password-field";
import { passwordHint, type FlowState } from "../lib/auth-flow/shared";
import { registerProfessional, requestPasswordRecovery, saveRecoveredPassword } from "../app/auth/flow-actions";

export default function AccountForm({ mode }: { mode: "signup" | "request" | "reset" }) {
  const [state, setState] = useState<FlowState>({});
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const signup = mode === "signup", reset = mode === "reset";
  const action = signup ? registerProfessional : reset ? saveRecoveredPassword : requestPasswordRecovery;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setPending(true); setState({});
    try {
      const result = await action(new FormData(event.currentTarget));
      setState(result);
      if (result.destination) window.location.assign(result.destination);
    } catch { setState({ error: "Não foi possível conectar. Tente novamente em instantes." }); }
    finally { lock.current = false; setPending(false); }
  }
  const fields = state.fieldErrors || {};
  function input(name: string, label: string, autocomplete: string, type = "text") {
    return <div className="field"><label htmlFor={"account-" + name}>{label}</label><input id={"account-" + name} name={name} type={type} autoComplete={autocomplete} required maxLength={type === "email" ? 254 : 160} aria-invalid={Boolean(fields[name])} aria-describedby={fields[name] ? name + "-error" : undefined} />{fields[name] && <p className="auth-field-error" id={name + "-error"}>{fields[name]}</p>}</div>;
  }
  if (state.success) return <><p className="form-message success" role="status">{state.success}</p><Link className="button secondary auth-submit" href="/login">Já tenho conta. Entrar</Link></>;
  return <><form onSubmit={submit} aria-busy={pending}>
    {signup && <>{input("fullName", "Nome do profissional", "name")}{input("businessName", "Nome do negócio", "organization")}</>}
    {!reset && input("email", "E-mail", "email", "email")}
    {(signup || reset) && <><PasswordField id="account-password" label={reset ? "Nova senha" : "Senha"} name="password" minLength={10} error={fields.password} aria-describedby="password-hint" /><PasswordField id="account-confirmation" label={reset ? "Confirmação da nova senha" : "Confirmação de senha"} name="confirmation" error={fields.confirmation} /><p className="auth-password-hint" id="password-hint">{passwordHint}</p></>}
    <div className="auth-flow-feedback" aria-live="polite">{state.error && <p className="form-message error" role="alert">{state.error}</p>}{pending && <p role="status">Processando. Aguarde…</p>}</div>
    {state.invalidLink ? <Link className="button primary auth-submit" href="/esqueci-senha">Solicitar outro link</Link> : <button type="submit" className="button primary auth-submit" disabled={pending}>{pending ? (signup ? "Criando conta…" : reset ? "Salvando…" : "Enviando…") : signup ? "Criar minha conta" : reset ? "Salvar nova senha" : "Enviar link de recuperação"}</button>}
  </form>{signup && <p className="auth-switch"><Link className="text-link" href="/login">Já tenho conta. Entrar</Link></p>}</>;
}
