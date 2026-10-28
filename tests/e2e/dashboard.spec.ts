import { expect, test } from "@playwright/test";

test("dashboard interactions work in Chromium without console errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "O fluxo lateral é validado no viewport desktop.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Cliente", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Cadastrar cliente" })).toBeVisible();
  await page.getByRole("button", { name: "Validar cadastro" }).click();
  await expect(page.locator(".form-message[role='alert']")).toHaveText("Informe o nome completo do cliente.");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Clientes" }).click();
  await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
  await page.getByLabel("Aparência").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("mobile menu opens and closes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Controle disponível somente no viewport móvel.");
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByLabel("Navegação principal")).toHaveClass(/sidebar-open/);
  await page.getByRole("button", { name: "Fechar menu" }).click();
  await expect(page.getByLabel("Navegação principal")).not.toHaveClass(/sidebar-open/);
});
