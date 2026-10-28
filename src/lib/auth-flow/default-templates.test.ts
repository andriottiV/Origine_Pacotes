import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { server, issue, close } = vi.hoisted(() => ({ server: vi.fn(), issue: vi.fn(), close: vi.fn() }));
vi.mock("../supabase/server", () => ({ createSupabaseServerClient: server }));
vi.mock("./origin", () => ({ authOrigin: () => "https://origine-pacotes.vercel.app" }));
vi.mock("./recovery", () => ({ issueRecoveryGrant: issue, closeRecoverySession: close }));
import { handleAuthCallback } from "./callback";

const origin = "https://origine-pacotes.vercel.app";
const authOrigin = "https://local-auth.example.invalid";
const testUser = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function harness(flow: "signup" | "recovery", failure?: "expired") {
  const jar = new Map<string, string>();
  let challenge = "";
  const claims = {
    sub: testUser.id, aud: "authenticated", iss: authOrigin + "/auth/v1", role: "authenticated",
    session_id: "00000000-0000-4000-8000-000000000002", exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000), amr: [{ method: flow === "recovery" ? "recovery" : "email/signup", timestamp: Math.floor(Date.now() / 1000) }],
  };
  // Test-only token returned by the local fetch double. Never a real Auth session.
  const token = encode({ alg: "HS256", typ: "JWT" }) + "." + encode(claims) + ".local-test-signature";
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin !== authOrigin) throw new Error("External requests are forbidden in this test");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } });
    if (url.pathname === "/auth/v1/signup" || url.pathname === "/auth/v1/recover") {
      expect(url.searchParams.get("redirect_to")).toBe(origin + "/auth/callback?flow=" + flow);
      expect(body.code_challenge_method).toBe("s256");
      expect(body.code_challenge).toMatch(/^[a-zA-Z0-9_-]+$/);
      challenge = body.code_challenge;
      return json(flow === "signup" ? { user: testUser } : {});
    }
    if (url.pathname === "/auth/v1/token") {
      expect(url.searchParams.get("grant_type")).toBe("pkce");
      expect(body.auth_code).toBe("local-auth-code");
      expect(createHash("sha256").update(body.code_verifier).digest("base64url")).toBe(challenge);
      if (failure === "expired") return json({ code: "flow_state_expired", msg: "Expired test code" }, 400);
      return json({ access_token: token, refresh_token: "local-test-refresh", token_type: "bearer", expires_in: 3600, user: testUser });
    }
    if (url.pathname === "/auth/v1/user") {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer " + token);
      // Emulates Auth validating the exact issued fixture for the HS256 getClaims fallback.
      return json(testUser);
    }
    if (url.pathname === "/rest/v1/rpc/has_client_identity") return json(false);
    throw new Error("Unexpected test request: " + url.pathname);
  });
  const client = (cookies = jar) => createServerClient(authOrigin, "local-publishable-placeholder", {
    global: { fetch: fetcher },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: values => { for (const value of values) { if (value.options?.maxAge === 0) cookies.delete(value.name); else cookies.set(value.name, value.value); } },
    },
  });
  async function begin() {
    const sdk = client();
    const redirectTo = origin + "/auth/callback?flow=" + flow;
    const result = flow === "signup"
      ? await sdk.auth.signUp({ email: testUser.email, password: "OnlyLocalTests123!", options: { emailRedirectTo: redirectTo } })
      : await sdk.auth.resetPasswordForEmail(testUser.email, { redirectTo });
    expect(result.error).toBeNull();
    expect([...jar.keys()].some(name => name.includes("-code-verifier"))).toBe(true);
  }
  return { jar, fetcher, client, begin };
}

beforeEach(() => vi.clearAllMocks());
describe("standard ConfirmationURL links with the installed Supabase SSR/Auth SDKs", () => {
  it.each(["signup", "recovery"] as const)("persists the %s verifier, exchanges the default-template code and writes session cookies", async flow => {
    const test = harness(flow);
    await test.begin();
    const callbackSdk = test.client();
    server.mockResolvedValue(callbackSdk);
    const url = new URL("/auth/callback?flow=" + flow, origin);
    // GoTrue's PKCE redirect adds code to the existing redirect_to query.
    url.searchParams.set("code", "local-auth-code");
    const response = await handleAuthCallback(new Request(url));
    expect(response.headers.get("location")).toBe(origin + (flow === "signup" ? "/auth/complete" : "/redefinir-senha"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect([...test.jar.keys()].some(name => name.includes("-auth-token") && !name.includes("-code-verifier"))).toBe(true);
    expect([...test.jar.keys()].some(name => name.includes("-code-verifier"))).toBe(false);
    expect(issue).toHaveBeenCalledTimes(flow === "recovery" ? 1 : 0);
  });
  it.each(["signup", "recovery"] as const)("rejects a %s link opened without the original browser cookie", async flow => {
    const test = harness(flow); await test.begin();
    server.mockResolvedValue(test.client(new Map()));
    const response = await handleAuthCallback(new Request(origin + "/auth/callback?flow=" + flow + "&code=local-auth-code"));
    expect(response.headers.get("location")).toBe(origin + "/auth/erro?flow=" + flow);
    expect(test.fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === "/auth/v1/token")).toBe(false);
    expect(issue).not.toHaveBeenCalled();
  });
  it("rejects an expired recovery code without issuing recovery authorization", async () => {
    const test = harness("recovery", "expired"); await test.begin();
    server.mockResolvedValue(test.client());
    const response = await handleAuthCallback(new Request(origin + "/auth/callback?flow=recovery&code=local-auth-code"));
    expect(response.headers.get("location")).toBe(origin + "/auth/erro?flow=recovery");
    expect(issue).not.toHaveBeenCalled();
  });
});
