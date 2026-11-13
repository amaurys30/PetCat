import { expect, test, type Page } from "@playwright/test";
import { cancelarSiActiva, contextoSalud, PASSWORD, PROPIETARIO_SALUD, reservaPendiente } from "./citas";

/**
 * P7 · Teclado: al cerrar con Escape "Nueva cita" y el detalle de una cita, el foco vuelve al
 * botón que los abrió; "Saltar al contenido" lleva el foco al contenido principal.
 */
async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
}

test("Escape en Nueva cita y en el detalle devuelve el foco al botón que los abrió", async ({ page, request }) => {
  test.setTimeout(60_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda`);

    const nueva = page.getByRole("button", { name: "Nueva cita" });
    await nueva.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Nueva cita" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Nueva cita" })).toHaveCount(0);
    await expect(nueva).toBeFocused();

    const abrirDetalle = page
      .getByRole("list", { name: "Citas por confirmar" })
      .getByRole("listitem")
      .filter({ hasText: cita.mascota.nombre })
      .filter({ hasText: cita.hora_inicio })
      .getByRole("button")
      .first();
    await abrirDetalle.focus();
    await page.keyboard.press("Enter");
    const detalle = page.getByRole("dialog", { name: `Cita #${cita.id_cita}` });
    await expect(detalle).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detalle).toHaveCount(0);
    await expect(abrirDetalle).toBeFocused();
  } finally {
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});

test("Saltar al contenido es lo primero con el teclado y lleva el foco al contenido", async ({ page }) => {
  await entrar(page);
  await page.keyboard.press("Tab");
  const saltar = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(saltar).toBeFocused();
  await expect(saltar).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
