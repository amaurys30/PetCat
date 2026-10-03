import { expect, test } from "@playwright/test";

/**
 * A6 contra la API de demo: registro → crear negocio → abandonar después del paso 1 →
 * entrar desde otro navegador y retomar donde quedó (lo decide la API con
 * configuracion_pendiente). Sin clave de Google: la sede usa coordenadas manuales.
 */
test("crea el negocio en tres pasos y retoma el asistente en otro navegador", async ({ browser, page }) => {
  // Registro, dos navegadores y los tres pasos: con la suite en paralelo pasa de 30 s.
  test.setTimeout(60_000);
  const email = `negocio.${Date.now()}@petcat.test`;
  const password = "Patitas123";

  await page.goto("/registro");
  await page.getByLabel("Nombre *").fill("Valentina");
  await page.getByLabel("Apellido *").fill("Torres");
  await page.getByLabel("Correo electrónico *").fill(email);
  await page.getByLabel("Contraseña *").fill(password);
  await page.getByLabel(/Acepto la política/).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByRole("link", { name: /Crear mi negocio/ }).click();

  await expect(page.getByText(/Empiezas en el plan Gratuito: 1 sede/)).toBeVisible();
  await page.getByLabel("Nombre del negocio *").fill("Patitas Norte");
  await page.getByLabel("Teléfono").fill("3001234567");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page).toHaveURL(/\/negocios\/\d+\/configurar$/);
  await expect(page.getByLabel("Nombre de la sede *")).toHaveValue("Sede principal");

  // Abandona aquí y vuelve desde otro navegador: el asistente sigue en la sede.
  const otro = await browser.newContext();
  const retomar = await otro.newPage();
  await retomar.goto("/login");
  await retomar.getByLabel("Correo electrónico").fill(email);
  await retomar.getByLabel("Contraseña", { exact: true }).fill(password);
  await retomar.getByRole("button", { name: "Ingresar" }).click();
  await expect(retomar).toHaveURL(/\/negocios\/\d+\/configurar$/);
  await expect(retomar.getByRole("listitem").filter({ hasText: "Sede principal" })).toHaveAttribute(
    "aria-current",
    "step",
  );

  await retomar.getByLabel("Dirección *").fill("Cra 19 #22-35, Centro");
  await retomar.getByLabel("Latitud").fill("9.30472");
  await retomar.getByLabel("Longitud").fill("-75.39778");
  await retomar.getByRole("button", { name: /Continuar/ }).click();
  await expect(retomar).toHaveURL(/\?paso=horarios$/);

  await retomar.getByRole("button", { name: "L–S 8–18" }).click();
  await retomar.getByRole("button", { name: "Terminar" }).click();
  await expect(retomar).toHaveURL(/\/n\/\d+\/dashboard$/);
  await expect(retomar.getByRole("button", { name: /Patitas Norte/ })).toBeVisible();

  // Ya completo: en el selector no aparece como pendiente.
  await retomar.goto("/negocios");
  await expect(retomar.getByRole("link", { name: /Patitas Norte/ })).not.toContainText(
    "Configuración pendiente",
  );
  await otro.close();
});
