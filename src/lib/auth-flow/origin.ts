import "server-only";

const localOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3101", "http://127.0.0.1:3101"]);

export function authOrigin(requestOrigin?: string | null) {
  if (process.env.NODE_ENV !== "production" && requestOrigin && localOrigins.has(requestOrigin)) return requestOrigin;
  const configured = process.env.SITE_URL;
  if (!configured) throw new Error("Defina SITE_URL no servidor para configurar os links de autenticação.");
  const url = new URL(configured);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !localOrigins.has(url.origin))) throw new Error("SITE_URL inválida.");
  return url.origin;
}
export function authCallbackUrl(origin: string, flow: "signup" | "recovery") {
  return new URL("/auth/callback?flow=" + flow, origin).toString();
}
