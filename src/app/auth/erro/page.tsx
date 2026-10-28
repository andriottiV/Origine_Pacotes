import Link from "next/link";
import { connection } from "next/server";
import AuthLayout from "../../../components/auth-layout";
export const instant = false;
export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  await connection();
  const recovery = (await searchParams).flow === "recovery";
  return <AuthLayout title="Não foi possível validar o link" intro="O link pode ter expirado, já ter sido utilizado ou ter sido aberto em outro navegador.">
    <Link className="button primary auth-submit" href={recovery ? "/esqueci-senha" : "/cadastro"}>{recovery ? "Solicitar outro link" : "Voltar ao cadastro"}</Link>
    {!recovery && <p className="auth-password-hint">Se já confirmou seu e-mail, entre com sua senha. Se necessário, use a recuperação de senha para receber outro link de acesso.</p>}
  </AuthLayout>;
}
