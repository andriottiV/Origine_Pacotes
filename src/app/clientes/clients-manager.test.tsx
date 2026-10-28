// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
const { refresh, create, update } = vi.hoisted(() => ({ refresh: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./actions", () => ({ createClient: create, updateClient: update, archiveClient: vi.fn() }));
vi.mock("./access-button", () => ({ default: () => <button>Gerenciar acesso</button> }));
import ClientsManager from "./clients-manager";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const clients = [
  { id: "unit-a", full_name: "Cliente A", phone_normalized: "11999990001", notes: "Observação A", status: "active", created_at: "" },
  { id: "unit-b", full_name: "Cliente B", phone_normalized: "11999990002", notes: "Observação B", status: "archived", created_at: "" },
];
describe("client list and edit presentation", () => {
  it("keeps search and record actions and updates all fields when selecting another client", async () => {
    const user = userEvent.setup();
    render(<ClientsManager clients={clients} query="busca" />);
    expect(screen.getByLabelText("Pesquisar por nome ou telefone")).toHaveValue("busca");
    expect(screen.getByRole("table")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Cliente A");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Cliente B");
    expect(screen.getByLabelText("Telefone")).toHaveValue("11999990002");
    expect(screen.getByLabelText("Observações")).toHaveValue("Observação B");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("");
  });
  it("resets the saved form safely and retains server error feedback", async () => {
    const user = userEvent.setup();
    create.mockResolvedValueOnce({ success: "Cliente cadastrado." }).mockResolvedValueOnce({ error: "Não foi possível cadastrar." });
    render(<ClientsManager clients={[]} query="" />);
    await user.type(screen.getByLabelText("Nome completo"), "Cliente de teste");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cliente cadastrado.");
    expect(screen.getByLabelText("Nome completo")).toHaveValue("");
    expect(refresh).toHaveBeenCalledTimes(1);
    await user.clear(screen.getByLabelText("Nome completo"));
    await user.type(screen.getByLabelText("Nome completo"), "Cliente de teste");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível cadastrar.");
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Cliente de teste");
  });
});
