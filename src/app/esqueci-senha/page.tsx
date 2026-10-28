import AuthLayout from "../../components/auth-layout";
import AccountForm from "../../components/account-form";
export default function RecoveryRequestPage() {
  return <AuthLayout title="Vamos recuperar seu acesso" intro="Informe seu e-mail e abra o link de recuperação neste mesmo navegador."><AccountForm mode="request" /></AuthLayout>;
}
