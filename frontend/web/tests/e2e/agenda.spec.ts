import { expect, test, type Page } from "@playwright/test";
import {
  bloquearHoraDe,
  cancelarSiActiva,
  contextoSalud,
  PASSWORD,
  PROPIETARIO_SALUD,
  quitarBloqueo,
  reservaPendiente,
} from "./citas";

/**
 * P4.1 · Agenda contra la API de demo, en Salud Animal (propietario). Cada prueba crea su
 * cita pendiente (y su bloqueo) por la API y los quita al final: no depende de las citas
 * del seed, que vencen.
 */
async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
}

test("la reserva aparece por confirmar y, con un bloqueo, fuera de disponibilidad; abre su día con el bloqueo", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  const bloqueo = await bloquearHoraDe(request, ctx, cita, "Prueba e2e");
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda`);

    const porConfirmar = page.getByRole("list", { name: "Citas por confirmar" });
    const pendiente = porConfirmar
      .getByRole("listitem")
      .filter({ hasText: cita.mascota.nombre })
      .filter({ hasText: cita.hora_inicio });
    await expect(pendiente).toContainText(/Se cancela sola en/);

    const fuera = page.getByRole("list", { name: "Citas fuera de disponibilidad" });
    const tarjeta = fuera.getByRole("listitem").filter({ hasText: "tiene un bloqueo: Prueba e2e" });
    await expect(tarjeta).toContainText(cita.mascota.nombre);
    await tarjeta.getByRole("button").first().click();
    await expect(page).toHaveURL(new RegExp(`cita=${cita.id_cita}`));
    await expect(page.getByRole("dialog", { name: `Cita #${cita.id_cita}` })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("radio", { name: "Día" }).click();
    const profesional = page.getByRole("group", {
      name: `${cita.empleado!.nombre} ${cita.empleado!.apellido}`,
    });
    await expect(profesional.getByText(/^Bloqueo .* · Prueba e2e$/)).toBeVisible();
    await expect(
      // Puede haber canceladas de otras corridas a la misma hora: la de esta prueba está por confirmar.
      profesional.getByRole("button", {
        name: new RegExp(`^${cita.hora_inicio}–.* · ${cita.mascota.nombre} · .*por confirmar`),
      }),
    ).toBeVisible();
  } finally {
    await quitarBloqueo(request, ctx, bloqueo);
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});

test("la lista filtrada por profesional solo trae sus citas y el filtro queda en la URL", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  const nombre = `${cita.empleado!.nombre} ${cita.empleado!.apellido}`;
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda?vista=lista&fecha=${cita.fecha}`);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();

    await page.getByRole("combobox", { name: "Profesional" }).click();
    await page.getByRole("option", { name: nombre }).click();
    await expect(page).toHaveURL(/profesional=\d+/);

    const filas = page.getByRole("region").getByRole("button");
    await expect(filas.filter({ hasText: cita.mascota.nombre }).first()).toBeVisible();
    await expect(filas.filter({ hasNotText: nombre })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Profesional" })).toHaveText(nombre);
  } finally {
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});
