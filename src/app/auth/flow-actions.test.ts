import { beforeEach, describe, expect, it, vi } from "vitest";
const { server, origin, grant, close } = vi.hoisted(() => ({ server: vi.fn(), origin: vi.fn(() => "https://origine-pacotes.vercel.app"), grant: vi.fn(), close: vi.fn() }));
vi.mock("../../lib/supabase/server", () => ({ createSupabaseServerClient: server }));
vi.mock("../../lib/auth-flow/origin", () => ({ authOrigin: origin, authCallbackUrl: (base: string, flow: string) => base + "/auth/callback?flow=" + flow }));
vi.mock("../../lib/auth-flow/recovery", () => ({ getRecoveryGrant: grant, closeRecoverySession: close }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "https://malicious.invalid" }) }));
import { registerProfessional, requestPasswordRecovery, saveRecoveredPassword } from "./flow-actions";
import { recoveryMessage, signupMessage } from "../../lib/auth-flow/shared";
const validForm = () => { const form = new FormData(); for (const [name, value] of Object.entries({ fullName: "Profissional de teste", businessName: "Negócio de teste", email: "test@example.invalid", password: "OnlyTests123!", confirmation: "OnlyTests123!", role: "admin", organization_id: "another-tenant" })) form.set(name, value); return form; };
beforeEach(() => { vi.clearAllMocks(); });
describe("professional registration", () => {
  it("sends only safe signup metadata and waits for confirmation without a session", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: {}, session: null }, error: null }), rpc = vi.fn();
    server.mockResolvedValue({ auth: { signUp }, rpc });
    expect(await registerProfessional(validForm())).toEqual({ success: signupMessage });
    expect(signUp).toHaveBeenCalledWith({ email: "test@example.invalid", password: "OnlyTests123!", options: { emailRedirectTo: "https://origine-pacotes.vercel.app/auth/callback?flow=signup", data: { full_name: "Profissional de teste", business_name: "Negócio de teste", account_type: "professional" } } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps duplicate-registration feedback neutral", async () => {
    server.mockResolvedValue({ auth: { signUp: vi.fn().mockResolvedValue({ data: {}, error: { code: "user_already_exists", status: 422 } }) } });
    expect(await registerProfessional(validForm())).toEqual({ success: signupMessage });
  });
  it("does not allow password mismatch and never sends it to Auth", async () => {
    const form = validForm(); form.set("confirmation", "different");
    expect((await registerProfessional(form)).fieldErrors?.confirmation).toBe("As senhas não coincidem.");
    expect(server).not.toHaveBeenCalled();
  });
  it("with an immediate session routes through provisioning rather than straight to the dashboard", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "migration missing" } });
    server.mockResolvedValue({ auth: { signUp: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }) }, rpc });
    expect(await registerProfessional(validForm())).toEqual({ destination: "/auth/complete" });
    expect(rpc).toHaveBeenCalledWith("complete_professional_signup");
  });
});
describe("password recovery request", () => {
  it.each([null, { status: 400, code: "user_not_found" }])("returns the same neutral response for existing and absent emails", async error => {
    const reset = vi.fn().mockResolvedValue({ error }); server.mockResolvedValue({ auth: { resetPasswordForEmail: reset } });
    expect(await requestPasswordRecovery(validForm())).toEqual({ success: recoveryMessage });
    expect(reset).toHaveBeenCalledWith("test@example.invalid", { redirectTo: "https://origine-pacotes.vercel.app/auth/callback?flow=recovery" });
  });
  it.each([{ status: 429 }, { status: 503 }, { name: "AuthRetryableFetchError" }])("separately reports rate limits and network failures", async error => {
    server.mockResolvedValue({ auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error }) } });
    expect((await requestPasswordRecovery(validForm())).error).toBeTruthy();
  });
});
describe("saving a recovered password", () => {
  it("refuses a plain logged-in session or an invalid grant", async () => {
    grant.mockResolvedValue(null);
    expect((await saveRecoveredPassword(validForm())).invalidLink).toBe(true);
  });
  it("claims once before updating the password and signs out before returning to login", async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const name of ["update", "eq", "is", "gt", "select"]) query[name] = vi.fn(() => query);
    query.maybeSingle = vi.fn().mockResolvedValue({ data: { token_hash: "hash" }, error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const supabase = { auth: { updateUser } };
    grant.mockResolvedValue({ supabase, admin: { from: () => query }, tokenHash: "hash", userId: "user", sessionId: "session" });
    expect(await saveRecoveredPassword(validForm())).toEqual({ destination: "/login?status=senha-atualizada" });
    expect(query.eq).toHaveBeenCalledWith("session_id", "session");
    expect(query.is).toHaveBeenCalledWith("used_at", null);
    expect(updateUser).toHaveBeenCalledWith({ password: "OnlyTests123!" });
    expect(close).toHaveBeenCalledWith(supabase);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await saveRecoveredPassword(validForm())).invalidLink).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);
  });
});
