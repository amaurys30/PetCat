import { expect, test } from "@playwright/test";

/** A7 contra la API de demo. Cada corrida crea una cuenta nueva con un correo único. */
test("crea la cuenta desde el panel, entra y ve la bienvenida", async ({ page }) => {
  const email = `registro.${Date.now()}@petcat.test`;
  await page.goto("/registro");
  await page.getByLabel("Nombre *").fill("Valentina");
  await page.getByLabel("Apellido *").fill("Torres");
  await page.getByLabel("Correo electrónico *").fill(email);
  await page.getByLabel("Teléfono").fill("300 987 6543");
  await page.getByLabel("Contraseña *").fill("Patitas123");
  await page.getByLabel(/Acepto la política/).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/negocios$/);
  await expect(page.getByRole("heading", { name: "Hola, Valentina" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("link", { name: /Crear mi negocio/ })).toBeVisible();

  // La sesión quedó iniciada: al recargar sigue en la bienvenida.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hola, Valentina" })).toBeVisible();
});

test("con un correo ya registrado ofrece recuperar la contraseña", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Nombre *").fill("Laura");
  await page.getByLabel("Apellido *").fill("Gómez");
  await page.getByLabel("Correo electrónico *").fill("propietario@petcat.test");
  await page.getByLabel("Contraseña *").fill("Patitas123");
  await page.getByLabel(/Acepto la política/).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByRole("alert")).toContainText("Ya existe una cuenta con ese correo");
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await expect(page).toHaveURL(/\/recuperar-password\?email=/);
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("propietario@petcat.test");
});
