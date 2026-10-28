import { beforeEach, describe, expect, it, vi } from "vitest";
const { sdk, redirect } = vi.hoisted(() => ({ sdk: { auth: { signOut: vi.fn() } }, redirect: vi.fn((path: string) => { throw new Error("redirect:" + path); }) }));
vi.mock("../../lib/supabase/server", () => ({ createSupabaseServerClient: async () => sdk }));
vi.mock("next/navigation", () => ({ redirect }));
import { signOutAdmin, signOutClient } from "./actions";
beforeEach(() => { vi.clearAllMocks(); sdk.auth.signOut.mockResolvedValue({ error: null }); });
describe("existing logout destinations", () => {
  it("keeps administrative logout local and returns to the administrative login", async () => {
    await expect(signOutAdmin()).rejects.toThrow("redirect:/login");
    expect(sdk.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("keeps client logout separate from administrative authentication", async () => {
    await expect(signOutClient()).rejects.toThrow("redirect:/cliente/login");
    expect(sdk.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
