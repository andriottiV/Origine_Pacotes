import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadUsageHistory } from "./usage-history";
function mockClient(count = 21) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: String(i), client_id: "c", client_package_id: "p", quantity: 1, occurred_at: "2026-11-01T12:00:00Z", reversed_at: i === 0 ? "2026-11-01T13:00:00Z" : null, created_by: "staff", clients: [{ full_name: "Client" }], client_packages: [{ package_name: "Package" }] }));
  const query = { select: vi.fn(), order: vi.fn(), range: vi.fn(), eq: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve) };
  for (const fn of [query.select, query.order, query.range, query.eq]) fn.mockReturnValue(query);
  const from = vi.fn(() => query); const rpc = vi.fn().mockResolvedValue({ data: [{ user_id: "staff", full_name: "Professional" }], error: null });
  return { supabase: { from, rpc } as unknown as SupabaseClient, query, from, rpc };
}
describe("bounded usage history", () => {
  it("loads one bounded page including reversals and joined labels", async () => {
    const { supabase, query, from } = mockClient();
    const result = await loadUsageHistory(supabase, "org", "client", 2);
    expect(query.range).toHaveBeenCalledWith(40, 60); expect(from).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org"); expect(query.eq).toHaveBeenCalledWith("client_id", "client");
    expect(result.rows).toHaveLength(20); expect(result.hasMore).toBe(true);
    expect(result.rows[0]).toMatchObject({ client_name: "Client", package_name: "Package", professional_name: "Professional", reversed_at: "2026-11-01T13:00:00Z" });
  });
  it("dashboard reads eleven rows, not all organizational usages", async () => {
    const { supabase, query } = mockClient(11);
    const result = await loadUsageHistory(supabase, "org", undefined, 0, 10);
    expect(query.range).toHaveBeenCalledWith(0, 10); expect(result.rows).toHaveLength(10);
  });
  it("portal stays scoped to the client and does not request professional directory", async () => {
    const { supabase, query, rpc } = mockClient(2);
    const result = await loadUsageHistory(supabase, undefined, "own-client");
    expect(query.eq).toHaveBeenCalledWith("client_id", "own-client"); expect(rpc).not.toHaveBeenCalled(); expect(result.hasMore).toBe(false);
  });
});
