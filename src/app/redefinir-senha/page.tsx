import Link from "next/link";
import { connection } from "next/server";
import AuthLayout from "../../components/auth-layout";
import AccountForm from "../../components/account-form";
import { getRecoveryGrant } from "../../lib/auth-flow/recovery";
export const instant = false;
export default async function ResetPasswordPage() {
  await connection();
  let valid = false, unavailable = false;
  try { valid = Boolean(await getRecoveryGrant()); } catch { unavailable = true; }
  return <AuthLayout title={valid ? "Uma nova senha para continuar" : unavailable ? "Não foi possível verificar seu acesso" : "Vamos tentar um novo link"} intro={valid ? "Defina uma nova senha para sua conta profissional." : unavailable ? "O serviço está indisponível no momento. Tente novamente em instantes." : "Este link expirou, já foi utilizado ou não é válido. Solicite outro link para recuperar sua senha."}>
    {valid ? <AccountForm mode="reset" /> : <Link className="button primary auth-submit" href="/esqueci-senha">Solicitar outro link</Link>}
  </AuthLayout>;
}
