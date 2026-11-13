import { expect, test, type Page } from "@playwright/test";

/** Prueba de humo contra la API de demo (usuarios del seed, contraseña Petcat123!). */
const PASSWORD = "Petcat123!";

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("la propietaria entra directo a su negocio, recarga sin perder la sesión y la cierra", async ({
  page,
}) => {
  await entrar(page, "propietario@petcat.test");

  await expect(page).toHaveURL(/\/n\/\d+\/dashboard$/);
  const menu = page.getByRole("navigation", { name: "Secciones del negocio" });
  await expect(menu.getByRole("link", { name: "Configuración" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Clínica Veterinaria Patitas/ })).toBeVisible();
  // La tarjeta del plan del menú (el dashboard también lo dice en su etiqueta).
  await expect(page.getByText(/^\d+ de 30 citas este mes$/)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/n\/\d+\/dashboard$/);
  await expect(menu.getByRole("link", { name: "Agenda" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("con dos negocios elige en el selector y el menú respeta el rol", async ({ page }) => {
  await entrar(page, "vet.salud@petcat.test");

  await expect(page).toHaveURL(/\/negocios$/);
  await expect(page.getByText("Tienes acceso a 2 negocios.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Peluquería Canina Huellitas/ }).click();

  await expect(page).toHaveURL(/\/n\/\d+\/agenda$/);
  const menu = page.getByRole("navigation", { name: "Secciones del negocio" });
  await expect(menu.getByRole("link", { name: "Agenda" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Configuración" })).toHaveCount(0);
});

test("credenciales inválidas muestran el mensaje de la API", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("propietario@petcat.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("NoEsLaClave1");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("alert")).toContainText("Credenciales inválidas");
});

test("la sesión se comparte entre pestañas y el cierre también", async ({ context, page }) => {
  await entrar(page, "propietario@petcat.test");
  await expect(page).toHaveURL(/\/n\/\d+\/dashboard$/);

  const otra = await context.newPage();
  await otra.goto("/panel");
  await expect(otra).toHaveURL(/\/n\/\d+\/dashboard$/);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(otra).toHaveURL(/\/login$/);
});
