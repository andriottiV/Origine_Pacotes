import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, revalidate } = vi.hoisted(() => ({ rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOrganization: async () => ({ supabase: { rpc }, membership: { organization_id: "org" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
import { registerAttendance, reverseAttendance } from "./actions";
const uuid = "b6f8a482-2e80-4b68-8ed3-0262688553b0";
function form(quantity: string) { const f = new FormData(); for (const [k,v] of Object.entries({ packageId: uuid, clientId: uuid, idempotencyKey: uuid, quantity })) f.set(k,v); return f; }
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { quantity: 2 }, error: null }); });
describe("usage server actions", () => {
  it.each(["", "0", "3", "-1", "1.5", "NaN"])("rejects invalid quantity %s before RPC", async quantity => {
    expect(await registerAttendance({}, form(quantity))).toHaveProperty("error"); expect(rpc).not.toHaveBeenCalled();
  });
  it("binds client, organization, quantity and key and refreshes every balance page", async () => {
    expect(await registerAttendance({}, form("2"))).toHaveProperty("success");
    expect(rpc).toHaveBeenCalledWith("register_service_usage_for_client", { p_package_id: uuid, p_client_id: uuid, p_organization_id: "org", p_quantity: 2, p_idempotency_key: uuid });
    for (const path of ["/", "/clientes", "/cliente", "/atendimentos/novo"]) expect(revalidate).toHaveBeenCalledWith(path);
  });
  it("surfaces database rejection without claiming success", async () => {
    rpc.mockResolvedValue({ error: { message: "Saldo insuficiente" } });
    expect(await registerAttendance({}, form("2"))).toEqual({ error: "Saldo insuficiente" }); expect(revalidate).not.toHaveBeenCalled();
  });
  it("binds reversal to current organization", async () => {
    await reverseAttendance(uuid); expect(rpc).toHaveBeenCalledWith("reverse_service_usage", { p_usage_id: uuid, p_organization_id: "org" });
  });
});
