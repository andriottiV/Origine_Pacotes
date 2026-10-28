import { beforeEach, describe, expect, it, vi } from "vitest";
const { server, issue, close } = vi.hoisted(() => ({ server: vi.fn(), issue: vi.fn(), close: vi.fn() }));
vi.mock("../supabase/server", () => ({ createSupabaseServerClient: server }));
vi.mock("./origin", () => ({ authOrigin: () => "https://origine-pacotes.vercel.app" }));
vi.mock("./recovery", () => ({ issueRecoveryGrant: issue, closeRecoverySession: close }));
import { handleAuthCallback } from "./callback";
beforeEach(() => vi.clearAllMocks());
describe("verified Auth callbacks", () => {
  it.each([
    "?flow=recovery&code=one&code=two",
    "?flow=signup&flow=recovery&code=opaque",
    "?flow=recovery&type=signup&code=opaque",
    "?flow=recovery&code=opaque&error_code=otp_expired",
    "?flow=recovery&code=opaque&error_description=expired",
    "?flow=recovery&code=opaque&access_token=untrusted",
    "?flow=recovery&code=opaque&refresh_token=untrusted",
    "?flow=signup&code=opaque&token_hash=opaque",
    "?flow=recovery#access_token=untrusted&refresh_token=untrusted",
  ])("rejects ambiguous, error-bearing and implicit callbacks before exchanging a credential", async query => {
    const response = await handleAuthCallback(new Request("https://origine-pacotes.vercel.app/auth/callback" + query));
    expect(response.headers.get("location")).toContain("/auth/erro");
    expect(server).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it.each(["?type=invite&token_hash=not-a-token", "?flow=signup", "?flow=recovery&error=expired"])("rejects invalid links without creating grants", async query => {
    expect((await handleAuthCallback(new Request("https://origine-pacotes.vercel.app/auth/confirm" + query))).headers.get("location")).toContain("/auth/erro");
    expect(server).not.toHaveBeenCalled(); expect(issue).not.toHaveBeenCalled();
  });
  it("verifies recovery OTP and does not trust a caller-supplied redirect", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { session: {}, user: {} }, error: null });
    const supabase = { auth: { verifyOtp, getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "recovery" }] } }, error: null }) } };
    server.mockResolvedValue(supabase);
    const result = await handleAuthCallback(new Request("https://origine-pacotes.vercel.app/auth/confirm?token_hash=opaque&flow=recovery&type=recovery&next=https://malicious.invalid"));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "opaque", type: "recovery" });
    expect(issue).toHaveBeenCalledWith(supabase);
    expect(result.headers.get("location")).toBe("https://origine-pacotes.vercel.app/redefinir-senha");
  });
  it("rejects a signup code labeled as recovery and clears the newly created session", async () => {
    const supabase = { auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {}, user: {} }, error: null }), getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "email/signup" }] } }, error: null }) } };
    server.mockResolvedValue(supabase);
    expect((await handleAuthCallback(new Request("https://origine-pacotes.vercel.app/auth/callback?code=opaque&flow=recovery"))).headers.get("location")).toContain("/auth/erro");
    expect(issue).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledWith(supabase);
  });
  it("treats an already consumed code as invalid and leaves existing sessions alone", async () => {
    server.mockResolvedValue({ auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: { status: 403 } }) } });
    expect((await handleAuthCallback(new Request("https://origine-pacotes.vercel.app/auth/callback?code=used&flow=signup"))).headers.get("location")).toContain("/auth/erro");
    expect(close).not.toHaveBeenCalled();
  });
});
