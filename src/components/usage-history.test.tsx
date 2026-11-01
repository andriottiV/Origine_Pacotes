// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import UsageHistory from "./usage-history";
const { reverse, refresh } = vi.hoisted(() => ({ reverse: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/atendimentos/novo/actions", () => ({ reverseAttendance: reverse }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const usage = { id: "u1", client_id: "c1", client_package_id: "p1", quantity: 2, occurred_at: "2026-10-31T13:30:00Z", reversed_at: null, created_by: "professional", professional_name: "Profissional" };
const packages = [{ id: "p1", package_name: "Pacote 4" }];
beforeEach(() => {
  vi.clearAllMocks(); reverse.mockResolvedValue({ success: "Uso estornado." });
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(){this.setAttribute("open","");}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(){this.removeAttribute("open");}});
});
afterEach(cleanup);
it("shows time in São Paulo and requires confirmation before reversal", async () => {
  const user = userEvent.setup(); render(<UsageHistory usages={[usage]} packages={packages} canReverse />);
  expect(screen.getByText("31/10/2026 às 10:30 — 2 serviços utilizados")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Estornar uso" }));
  expect(reverse).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));
  await waitFor(() => expect(reverse).toHaveBeenCalledWith("u1"));
  expect(refresh).not.toHaveBeenCalled();
});
it("preserves reversed entries and hides reversal in the customer portal", () => {
  render(<UsageHistory usages={[usage, { ...usage, id: "u2", reversed_at: "2026-11-01T12:00:00Z" }]} packages={packages} />);
  expect(screen.getByText("Estornado em 01/11/2026 às 09:00")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Estornar uso" })).not.toBeInTheDocument();
});
