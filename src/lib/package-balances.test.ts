import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClientBalances, loadPackageBalances } from "./package-balances";
describe("bounded package balances", () => {
  it("requests authoritative balances only for visible clients and never loads the ledger", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ client_id: "visible", remaining: "6" }], error: null });
    const supabase = { rpc } as unknown as SupabaseClient;
    const result = await loadClientBalances(supabase, ["visible"], "org");
    expect(result.get("visible")).toBe(6); expect(rpc).toHaveBeenCalledWith("client_service_balances", { p_client_ids: ["visible"], p_organization_id: "org" });
    await loadClientBalances(supabase, [], "org"); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("reads packages for only the selected client with a page sentinel", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: Array.from({ length: 21 }, (_, i) => ({ id: String(i), remaining: 2 })), error: null });
    const result = await loadPackageBalances({ rpc } as unknown as SupabaseClient, "client", "org", true, 2);
    expect(rpc).toHaveBeenCalledWith("client_package_balances", { p_client_id: "client", p_organization_id: "org", p_usable_only: true, p_offset: 40, p_limit: 21 });
    expect(result.rows).toHaveLength(20); expect(result.hasMore).toBe(true);
  });
});
