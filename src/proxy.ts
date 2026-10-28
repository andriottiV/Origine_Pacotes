import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { recoveryClaims } from "./lib/auth-flow/shared";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: items => {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const path = request.nextUrl.pathname;
  const authRoute = path.startsWith("/auth/") || ["/cadastro", "/esqueci-senha", "/redefinir-senha"].includes(path);
  function redirect(pathname: string) {
    const target = request.nextUrl.clone(); target.pathname = pathname; target.search = "";
    const result = NextResponse.redirect(target);
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    return result;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (authRoute) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const isClientRoute = path === "/cliente" || path.startsWith("/cliente/");
  if (!user && path !== "/login" && path !== "/cliente/login") return redirect(isClientRoute ? "/cliente/login" : "/login");
  if (user) {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return redirect("/auth/erro");
    if (recoveryClaims(data.claims)) return redirect("/redefinir-senha");
    const { data: client, error: clientError } = await supabase.rpc("has_client_identity");
    if (clientError) return redirect("/auth/complete");
    if (client && !isClientRoute) return redirect("/cliente");
    if (path === "/login") return redirect("/auth/complete");
    if (path === "/") {
      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (membershipError || !membership) return redirect("/auth/complete");
    }
  }
  return response;
}
export const config = { matcher: ["/", "/clientes/:path*", "/pacotes/:path*", "/vendas/:path*", "/atendimentos/:path*", "/financeiro/:path*", "/relatorios/:path*", "/configuracoes/:path*", "/onboarding", "/login", "/cliente/:path*", "/cadastro", "/esqueci-senha", "/redefinir-senha", "/auth/:path*"] };
