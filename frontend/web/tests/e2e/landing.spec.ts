import { expect, test } from "@playwright/test";

/**
 * Páginas públicas contra la API de demo: la landing con su buscador real (GET /negocios),
 * el paso a /para-negocios y de ahí al registro. La landing no descarga el código del panel.
 */

test("landing, buscador, para negocios y registro", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/PetCat · Todo lo de tu mascota/);
  await expect(page.getByRole("heading", { level: 1, name: /Todo lo de tu mascota/ })).toBeVisible();

  // Buscador: sin ubicación del navegador, negocios del seed cerca de Sincelejo.
  await page.getByRole("link", { name: "Buscar veterinarias cerca" }).click();
  const lista = page.getByRole("list", { name: "Negocios cercanos" });
  await expect(lista).toBeVisible();
  await expect(page.getByText(/negocios? cerca de Sincelejo\./)).toBeVisible();
  const patitas = lista.getByRole("listitem").filter({ hasText: "Clínica Veterinaria Patitas" });
  await expect(patitas.getByText(/^a [\d,]+ (km|m)/)).toBeVisible();
  await expect(patitas.getByRole("button", { name: "Reservar desde la app · próximamente" })).toBeDisabled();

  // Otras pruebas crean negocios en la demo: todos los resultados tienen "Patitas" y está la del seed.
  await page.getByRole("searchbox", { name: "Buscar por nombre" }).fill("Patitas");
  await expect(lista.getByRole("listitem").filter({ hasNotText: "Patitas" })).toHaveCount(0);
  await expect(lista.getByRole("heading", { name: "Clínica Veterinaria Patitas" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar por nombre" }).fill("");
  await page.getByRole("button", { name: "Guarderías" }).click();
  await expect(lista.getByRole("heading", { name: "Guardería Patas Felices" })).toBeVisible();
  await expect(lista.getByRole("heading", { name: "Clínica Veterinaria Patitas" })).toHaveCount(0);

  // La landing no descargó el panel.
  expect(scripts.some((url) => url.includes("rutasPanel"))).toBe(false);

  // Para negocios y de ahí al registro.
  await page.getByRole("link", { name: "Conoce PetCat para negocios" }).click();
  await expect(page).toHaveURL(/\/para-negocios$/);
  await expect(page.getByRole("heading", { level: 1, name: /Agenda en línea/ })).toBeVisible();
  const planes = page.locator("#planes");
  await expect(planes.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(planes.getByText(/120\.000/)).toBeVisible();

  await page.getByRole("link", { name: "Crear mi negocio gratis" }).first().click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByRole("heading", { name: /Crea tu cuenta/i })).toBeVisible();
  expect(scripts.some((url) => url.includes("rutasPanel"))).toBe(true);
});

test("en celular el menú lleva a las secciones; con sesión el botón dice Ir al panel", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Preguntas" }).click();
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Tienes dudas?" })).toBeInViewport();

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Iniciar sesión" }).click();
  await page.getByLabel("Correo electrónico").fill("propietario@petcat.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("Petcat123!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+/);

  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Ir al panel" }).click();
  await expect(page).toHaveURL(/\/n\/\d+/);
});
