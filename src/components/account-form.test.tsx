// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
const { register, request, save } = vi.hoisted(() => ({ register: vi.fn(), request: vi.fn(), save: vi.fn() }));
vi.mock("../app/auth/flow-actions", () => ({ registerProfessional: register, requestPasswordRecovery: request, saveRecoveredPassword: save }));
import AccountForm from "./account-form";
import { recoveryMessage } from "../lib/auth-flow/shared";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("account forms", () => {
  it("labels registration fields and toggles each new-password field independently", async () => {
    const user = userEvent.setup(); render(<AccountForm mode="signup" />);
    expect(screen.getByLabelText("Nome do profissional")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Nome do negócio")).toHaveAttribute("autocomplete", "organization");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha", { exact: true })).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirmação de senha")).toHaveAttribute("type", "password");
  });
  it("prevents duplicate requests and shows neutral mail feedback", async () => {
    let finish!: (result: { success: string }) => void;
    request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<AccountForm mode="request" />);
    const form = screen.getByRole("button", { name: "Enviar link de recuperação" }).closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
    finish({ success: recoveryMessage });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(recoveryMessage));
  });
  it("associates password mismatch feedback and offers a new link when authorization expires", async () => {
    save.mockResolvedValueOnce({ error: "Revise os campos indicados.", fieldErrors: { confirmation: "As senhas não coincidem." } }).mockResolvedValueOnce({ error: "Link expirado.", invalidLink: true });
    render(<AccountForm mode="reset" />);
    fireEvent.submit(screen.getByRole("button", { name: "Salvar nova senha" }).closest("form")!);
    await waitFor(() => expect(screen.getByLabelText("Confirmação da nova senha")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Confirmação da nova senha")).toHaveAccessibleDescription("As senhas não coincidem.");
    fireEvent.submit(screen.getByRole("button", { name: "Salvar nova senha" }).closest("form")!);
    expect(await screen.findByRole("link", { name: "Solicitar outro link" })).toHaveAttribute("href", "/esqueci-senha");
  });
});
