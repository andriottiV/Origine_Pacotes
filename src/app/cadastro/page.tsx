import AuthLayout from "../../components/auth-layout";
import AccountForm from "../../components/account-form";
export default function SignupPage() {
  return <AuthLayout title="Seu próximo começo" intro="Crie sua conta profissional e organize seu negócio em um só lugar."><AccountForm mode="signup" /></AuthLayout>;
}
