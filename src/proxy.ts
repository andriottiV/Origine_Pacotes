import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  const isClientRoute = request.nextUrl.pathname.startsWith("/cliente");
  if (!user && request.nextUrl.pathname !== "/login" && request.nextUrl.pathname !== "/cliente/login") { const login = request.nextUrl.clone(); login.pathname = isClientRoute ? "/cliente/login" : "/login"; login.searchParams.set("next", request.nextUrl.pathname); return NextResponse.redirect(login); }
  if (user && request.nextUrl.pathname === "/login") { const home = request.nextUrl.clone(); home.pathname = "/"; return NextResponse.redirect(home); }
  if (user) { const { data: hasClientIdentity } = await supabase.rpc("has_client_identity"); if (hasClientIdentity && !isClientRoute) { const portal = request.nextUrl.clone(); portal.pathname = "/cliente"; return NextResponse.redirect(portal); } }
  return response;
}
export const config = { matcher: ["/", "/clientes/:path*", "/pacotes/:path*", "/vendas/:path*", "/atendimentos/:path*", "/financeiro/:path*", "/relatorios/:path*", "/configuracoes/:path*", "/onboarding", "/login", "/cliente/:path*"] };
