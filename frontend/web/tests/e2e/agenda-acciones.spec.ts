import { expect, test, type Page } from "@playwright/test";
import {
  cancelarSiActiva,
  citaDeHoy,
  contextoSalud,
  estadoDe,
  PASSWORD,
  PROPIETARIO_SALUD,
  reservaPendiente,
} from "./citas";

/**
 * P4.2 · Detalle y acciones de la cita contra la API de demo, en Salud Animal. Cada prueba
 * crea sus citas por la API (una reserva de la app queda pendiente) y cancela al final lo
 * que dejó activo.
 */
async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
}

test("confirmar desde el panel lateral", async ({ page, request }) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda`);
    const tarjeta = page
      .getByRole("list", { name: "Citas por confirmar" })
      .getByRole("listitem")
      .filter({ hasText: cita.mascota.nombre })
      .filter({ hasText: cita.hora_inicio });
    await tarjeta.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(`Cita de ${cita.mascota.nombre} confirmada`)).toBeVisible();
    await expect(tarjeta).toHaveCount(0);
    expect(await estadoDe(request, ctx, cita.id_cita)).toBe("confirmada");
  } finally {
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});

test("rechazar exige el motivo y cancela la cita", async ({ page, request }) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda?cita=${cita.id_cita}&fecha=${cita.fecha}`);
    const detalle = page.getByRole("dialog", { name: `Cita #${cita.id_cita}` });
    await expect(detalle.getByText(/^Confírmala antes de/)).toBeVisible();
    await detalle.getByRole("button", { name: "Rechazar" }).click();

    const dialogo = page.getByRole("dialog", { name: "Rechazar cita" });
    await dialogo.getByRole("button", { name: "Rechazar cita" }).click();
    await expect(dialogo.getByText("Escribe el motivo")).toBeVisible();
    await dialogo.getByRole("textbox").fill("No hay especialista ese día");
    await dialogo.getByRole("button", { name: "Rechazar cita" }).click();

    await expect(page.getByText("Cita rechazada")).toBeVisible();
    await expect(detalle.getByText(/^Cancelada por el negocio: No hay especialista ese día$/)).toBeVisible();
    expect(await estadoDe(request, ctx, cita.id_cita)).toBe("cancelada");
  } finally {
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});

test("reprogramar a otro horario libre crea la cita nueva y la abre", async ({ page, request }) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  let nueva: number | null = null;
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda?cita=${cita.id_cita}&fecha=${cita.fecha}`);
    await page
      .getByRole("dialog", { name: `Cita #${cita.id_cita}` })
      .getByRole("button", { name: "Reprogramar" })
      .click();

    const dialogo = page.getByRole("dialog", { name: "Reprogramar cita" });
    const horarios = dialogo.getByRole("radiogroup", { name: "Horarios libres" }).getByRole("radio");
    // Su propia hora también aparece libre (no se cuenta a sí misma); se elige otra.
    await expect(horarios.filter({ hasText: cita.hora_inicio })).toHaveCount(1);
    await dialogo.getByLabel("Motivo (opcional)").fill("El cliente pidió cambiar la hora");
    // Los horarios libres son por profesional: si la mascota ya tiene otra cita a esa hora
    // (409), el diálogo lo dice, recarga los horarios y se prueba el siguiente.
    const reprogramada = page.getByText(/^Cita reprogramada:/);
    for (let intento = 0; intento < 6 && !(await reprogramada.isVisible()); intento++) {
      const otra = horarios.filter({ hasNotText: cita.hora_inicio }).nth(intento);
      const hora = (await otra.textContent())!.trim();
      await otra.click();
      await dialogo.getByRole("button", { name: new RegExp(`^Reprogramar a .*, ${hora}$`) }).click();
      await expect(reprogramada.or(dialogo.getByRole("alert"))).toBeVisible();
    }
    await expect(page.getByText(/^Cita reprogramada:/)).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`cita=${cita.id_cita}(&|$)`));
    nueva = Number(new URL(page.url()).searchParams.get("cita"));
    const detalleNueva = page.getByRole("dialog", { name: `Cita #${nueva}` });
    await expect(
      detalleNueva.getByText(new RegExp(`Reprogramación de la cita #${cita.id_cita}`)),
    ).toBeVisible();
    expect(await estadoDe(request, ctx, cita.id_cita)).toBe("reprogramada");
    expect(await estadoDe(request, ctx, nueva)).toBe("confirmada");
  } finally {
    await cancelarSiActiva(request, ctx, cita.id_cita);
    if (nueva) await cancelarSiActiva(request, ctx, nueva);
  }
});

test("reasignar a otro profesional libre a esa hora", async ({ page, request }) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx, { conDos: true });
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda?cita=${cita.id_cita}&fecha=${cita.fecha}`);
    await page
      .getByRole("dialog", { name: `Cita #${cita.id_cita}` })
      .getByRole("button", { name: "Reasignar" })
      .click();

    const dialogo = page.getByRole("dialog", { name: "Reasignar profesional" });
    const actual = `${cita.empleado!.nombre} ${cita.empleado!.apellido}`;
    await expect(dialogo.getByRole("radio", { name: new RegExp(actual) })).toBeDisabled();
    const otro = dialogo.getByRole("radio", { disabled: false }).first();
    const nombre = (await otro.locator("span span").first().textContent())!.trim();
    await otro.click();
    await dialogo.getByRole("button", { name: `Reasignar a ${nombre}` }).click();

    await expect(page.getByText(`Cita reasignada a ${nombre}`)).toBeVisible();
    await expect(
      page
        .getByRole("dialog", { name: `Cita #${cita.id_cita}` })
        .getByText(`Profesional: ${actual} → ${nombre}`),
    ).toBeVisible();
  } finally {
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});

test("iniciar la atención y completar con el precio final", async ({ page, request }) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const cita = await citaDeHoy(request, ctx);
  // La Sede Norte atiende las 24 horas: solo en el último cuarto de hora del día no queda horario hoy.
  test.skip(!cita, "Es el último cuarto de hora del día: ya no quedan horarios hoy");
  try {
    await entrar(page);
    await page.goto(`/n/${ctx.idNegocio}/agenda?cita=${cita!.id_cita}`);
    const detalle = page.getByRole("dialog", { name: `Cita #${cita!.id_cita}` });
    await detalle.getByRole("button", { name: "Iniciar atención" }).click();
    await expect(page.getByText("Cita en curso")).toBeVisible();

    await detalle.getByRole("button", { name: "Completar" }).click();
    const dialogo = page.getByRole("dialog", { name: "Completar cita" });
    await dialogo.getByLabel("Precio final (COP) *").fill("95000");
    await dialogo.getByRole("button", { name: "Completar cita" }).click();

    await expect(page.getByText("Cita completada")).toBeVisible();
    // La fila "Precio final" de los datos y el cambio en el historial.
    const fila = detalle
      .getByRole("term")
      .filter({ hasText: /^Precio final$/ })
      .locator("..");
    await expect(fila).toContainText(/95\.000/);
    await expect(detalle.getByText(/^Precio final: .*95\.000$/)).toBeVisible();
    expect(await estadoDe(request, ctx, cita!.id_cita)).toBe("completada");
  } finally {
    if (cita) await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});
