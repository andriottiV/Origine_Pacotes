// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signIn, configured } = vi.hoisted(() => ({ signIn: vi.fn(), configured: vi.fn(() => true) }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "editorial-font" }) }));
vi.mock("../../lib/supabase/browser", () => ({
  isSupabaseConfigured: configured,
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword: signIn } }),
}));
import LoginForm from "./login-form";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("login presentation and authentication", () => {
  it("labels fields, toggles password accessibly and preserves the client destination", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "Acessar como cliente" })).toHaveAttribute("href", "/cliente/login");
  });

  it("keeps Supabase submission, prevents duplicates and announces authentication errors", async () => {
    let finish!: (value: { error: { message: string } }) => void;
    signIn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<LoginForm />);
    // Values stay inside the mocked client; this test makes no network requests.
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "interface@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "local-mock-only" } });
    const form = screen.getByRole("button", { name: "Entrar" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith({ email: "interface@example.invalid", password: "local-mock-only" });
    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Entrando. Aguarde.");
    finish({ error: { message: "mock auth error" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos."));
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-describedby", "login-error");
  });

  it("guides the professional to email confirmation before login", async () => {
    signIn.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    render(<LoginForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Confirme seu e-mail antes de entrar."));
  });

  it("shows configuration failures and handles connection failures without leaving the form locked", async () => {
    signIn.mockRejectedValue(new Error("offline"));
    render(<LoginForm configurationError="Configuração indisponível." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Configuração indisponível.");
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível conectar."));
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
});
