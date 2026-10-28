import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: client }));
import { proxy } from "./proxy";
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-placeholder"); });
function fakeUser(amr = "password", portal = false) {
  const membership = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: "tenant" }, error: null }) };
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "unit-user" } } }), getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: amr }] } }, error: null }) }, rpc: vi.fn().mockResolvedValue({ data: portal, error: null }), from: vi.fn(() => membership), membership };
}
describe("Auth proxy routing", () => {
  it("does not classify the administrative /clientes page as a client portal route", async () => {
    const sdk = fakeUser("password", true); client.mockReturnValue(sdk);
    expect((await proxy(new NextRequest("https://origine-pacotes.vercel.app/clientes"))).headers.get("location")).toBe("https://origine-pacotes.vercel.app/cliente");
  });
  it("keeps recovery sessions away from the dashboard and normal login redirect", async () => {
    client.mockReturnValue(fakeUser("recovery"));
    for (const path of ["/", "/login", "/clientes"]) expect((await proxy(new NextRequest("https://origine-pacotes.vercel.app" + path))).headers.get("location")).toBe("https://origine-pacotes.vercel.app/redefinir-senha");
  });
  it("keeps callbacks and reset pages reachable before the flow has a session", async () => {
    const sdk = fakeUser(); sdk.auth.getUser.mockResolvedValue({ data: { user: null } } as never); client.mockReturnValue(sdk);
    for (const path of ["/cadastro", "/esqueci-senha", "/redefinir-senha", "/auth/callback"]) expect((await proxy(new NextRequest("https://origine-pacotes.vercel.app" + path))).headers.get("location")).toBeNull();
  });
  it("does not let a professional without an organization enter the dashboard", async () => {
    const sdk = fakeUser(); sdk.membership.maybeSingle.mockResolvedValue({ data: null, error: null } as never); client.mockReturnValue(sdk);
    expect((await proxy(new NextRequest("https://origine-pacotes.vercel.app/"))).headers.get("location")).toBe("https://origine-pacotes.vercel.app/auth/complete");
  });
});
