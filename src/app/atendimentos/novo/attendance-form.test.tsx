// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceForm from "./attendance-form";
const { register, refresh } = vi.hoisted(() => ({ register: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ registerAttendance: register }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const clients = [{ id: "c1", full_name: "Cliente" }, { id: "c2", full_name: "Outro cliente" }];
const pkg = { id: "p1", client_id: "c1", package_name: "Pacote 4", remaining: 4, starts_on: "2026-10-01", expires_on: "2026-11-30", payment_status: "paid" };
function setup(packages = [pkg]) { render(<AttendanceForm packages={packages} clients={clients} initialClientId="c1" today="2026-11-01" />); return userEvent.setup(); }
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); register.mockResolvedValue({ success: "Uso registrado." }); });
describe("registrar uso", () => {
  it("requires explicit package and quantity selection and previews the balance", async () => {
    const user = setup([pkg, { ...pkg, id: "p2", package_name: "Outro pacote" }]);
    expect(screen.getByRole("button", { name: "Confirmar uso" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Pacote"), "p1");
    expect(screen.getByRole("radio", { name: "1 serviço" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar uso" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "2 serviços" }));
    expect(screen.getByText("Saldo atual: 4 · Utilizar: 2 · Restante: 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar uso" }));
    await screen.findByText("Uso registrado.");
    expect(refresh).not.toHaveBeenCalled();
    const data = register.mock.calls[0][1] as FormData;
    expect(data.get("quantity")).toBe("2"); expect(data.get("clientId")).toBe("c1");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("disables two services when only one remains", async () => {
    const user = setup([{ ...pkg, remaining: 1 }]);
    await user.selectOptions(screen.getByLabelText("Pacote"), "p1");
    expect(screen.getByRole("radio", { name: "2 serviços" })).toBeDisabled();
  });
  it.each([{ ...pkg, remaining: 0 }, { ...pkg, expires_on: "2026-10-31" }, { ...pkg, starts_on: "2026-11-02" }, { ...pkg, payment_status: "cancelled" }])("blocks ineligible packages: %j", p => {
    setup([p]); expect(screen.getByRole("button", { name: "Confirmar uso" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("não possui pacote válido com saldo");
  });
  it("retries a lost response with the identical request key and payload", async () => {
    register.mockRejectedValueOnce(new Error("network"));
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Pacote"), "p1");
    await user.click(screen.getByRole("radio", { name: "1 serviço" }));
    await user.click(screen.getByRole("button", { name: "Confirmar uso" }));
    await user.click(await screen.findByRole("button", { name: "Tentar novamente o mesmo uso" }));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(2));
    expect(register.mock.calls[0][1]).toBe(register.mock.calls[1][1]);
  });
});

it("locks immediately on duplicate submits and waits for server confirmation", async () => {
  let finish!: (value: { success: string }) => void;
  register.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const user = setup();
  await user.selectOptions(screen.getByLabelText("Pacote"), "p1");
  await user.click(screen.getByRole("radio", { name: "1 serviço" }));
  const button = screen.getByRole("button", { name: "Confirmar uso" });
  const form = button.closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(register).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Registrando…" })).toBeDisabled();
  expect(screen.queryByText("Uso registrado.")).not.toBeInTheDocument();
  finish({ success: "Uso registrado." });
  await screen.findByText("Uso registrado.");
  expect(refresh).not.toHaveBeenCalled();
});
