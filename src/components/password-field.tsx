"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({ id, label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="field"><label htmlFor={id}>{label}</label><div className="auth-password-wrap"><input {...props} id={id} type={visible ? "text" : "password"} autoComplete="new-password" required aria-invalid={Boolean(error)} aria-describedby={error ? id + "-error" : props["aria-describedby"]} /><button type="button" className="icon-button" aria-label={(visible ? "Ocultar " : "Mostrar ") + label.toLocaleLowerCase("pt-BR")} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div>{error && <p id={id + "-error"} className="auth-field-error">{error}</p>}</div>;
}
