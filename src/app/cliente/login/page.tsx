import { connection } from "next/server";
import { safePushDestination } from "@/lib/push/shared";
import ClientLoginForm from "./client-login-form";
export const instant = false;
export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection(); return <ClientLoginForm next={safePushDestination((await searchParams).next)} />;
}
