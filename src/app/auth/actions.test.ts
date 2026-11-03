import { beforeEach, describe, expect, it, vi } from "vitest";
const { sdk, redirect } = vi.hoisted(() => ({ sdk: { auth: { signOut: vi.fn() } }, redirect: vi.fn((path: string) => { throw new Error("redirect:" + path); }) }));
vi.mock("../../lib/supabase/server", () => ({ createSupabaseServerClient: async () => sdk }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/push/server", () => ({ detachPushDevice: vi.fn().mockResolvedValue(undefined) }));
import { detachPushDevice } from "@/lib/push/server";
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

it("detaches this device before clearing the client session",async()=>{
 await expect(signOutClient()).rejects.toThrow("redirect:/cliente/login");
 expect(vi.mocked(detachPushDevice).mock.invocationCallOrder[0]).toBeLessThan(sdk.auth.signOut.mock.invocationCallOrder[0]);
});
it("does not claim secure logout when the device cannot be detached",async()=>{
 vi.mocked(detachPushDevice).mockRejectedValueOnce(new Error("detach unavailable"));
 await expect(signOutClient()).rejects.toThrow("detach unavailable");expect(sdk.auth.signOut).not.toHaveBeenCalled();
});
