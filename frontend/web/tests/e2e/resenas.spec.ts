import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API, citaDeHoy, contextoSalud, PASSWORD, PROPIETARIO_SALUD, token } from "./citas";

/**
 * P6.3 · Reseñas contra la API de demo, en Salud Animal 24h. Cada corrida crea su propia
 * reseña (cita de hoy completada y reseñada por Camilo desde la "app"), porque un reporte
 * no se puede deshacer. Las reseñas quedan en petcat_demo (se limpian recargando la demo).
 */
async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** Reseña nueva de Camilo sobre una cita de hoy completada; null si hoy ya no hay horario. */
async function resenaNueva(request: APIRequestContext, titulo: string) {
  const ctx = await contextoSalud(request);
  const cita = await citaDeHoy(request, ctx);
  if (!cita) return null;
  for (const estado of ["en_curso", "completada"]) {
    const res = await request.patch(`${API}/citas/${cita.id_cita}/estado`, {
      headers: { Authorization: `Bearer ${ctx.tkNegocio}` },
      data: { estado },
    });
    expect(res.ok(), `${estado}: ${res.status()} ${await res.text()}`).toBe(true);
  }
  const res = await request.post(`${API}/citas/${cita.id_cita}/resena`, {
    headers: { Authorization: `Bearer ${await token(request, "camilo@petcat.test")}` },
    data: {
      calificacion: 2,
      titulo,
      comentario: "Esperamos más de lo previsto.",
      aspectos: { puntualidad: 2 },
    },
  });
  expect(res.ok(), `reseña: ${res.status()} ${await res.text()}`).toBe(true);
  return {
    idNegocio: ctx.idNegocio,
    idResena: ((await res.json()) as { data: { id_resena: number } }).data.id_resena,
  };
}

test("responde, borra la respuesta y reporta una reseña, que sigue visible", async ({ page, request }) => {
  test.setTimeout(60_000);
  const titulo = `Reseña E2E ${Date.now()}`;
  const nueva = await resenaNueva(request, titulo);
  test.skip(!nueva, "Hoy ya no queda horario en la Sede Norte");
  const { idNegocio, idResena } = nueva!;

  await entrar(page);
  await page.goto(`/n/${idNegocio}/resenas?resena=${idResena}`);
  await expect(page.getByText("Mostrando una reseña.")).toBeVisible();
  const tarjeta = page.getByRole("article", { name: "Reseña de Camilo Torres" });
  await expect(tarjeta.getByText(titulo)).toBeVisible();
  await expect(tarjeta.getByText('se muestra como "Camilo T."')).toBeVisible();
  await expect(
    tarjeta.getByText(/No incluyas datos del cliente ni información médica de su mascota\./),
  ).toBeVisible();

  await tarjeta.getByRole("textbox").fill("Gracias por contarnos. Ya ajustamos los tiempos de la agenda.");
  await tarjeta.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Respuesta publicada")).toBeVisible();
  await expect(
    tarjeta.getByText("Gracias por contarnos. Ya ajustamos los tiempos de la agenda."),
  ).toBeVisible();

  await tarjeta.getByRole("button", { name: /Más acciones/ }).click();
  await page.getByRole("menuitem", { name: "Borrar respuesta" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar respuesta" }).click();
  await expect(page.getByText("Respuesta borrada")).toBeVisible();
  await expect(tarjeta.getByRole("textbox")).toBeVisible();

  await tarjeta.getByRole("button", { name: /Más acciones/ }).click();
  await page.getByRole("menuitem", { name: "Reportar" }).click();
  const dialogo = page.getByRole("dialog", { name: "Reportar reseña" });
  await dialogo.getByRole("radio", { name: "Otro motivo" }).check();
  await dialogo.getByLabel("Detalle *").fill("Prueba de punta a punta");
  await dialogo.getByRole("button", { name: "Reportar" }).click();
  await expect(page.getByText("Reseña reportada: PetCat la revisará")).toBeVisible();
  await expect(tarjeta.getByText("Reportada · sigue visible hasta revisión")).toBeVisible();
  await expect(tarjeta.getByText(titulo)).toBeVisible();

  // Con el filtro de reportadas aparece junto a la del seed (Valeria).
  await page.getByRole("button", { name: "Ver todas las reseñas" }).click();
  await page.getByRole("radio", { name: /^Reportadas/ }).click();
  await expect(page).toHaveURL(/filtro=reportadas/);
  await expect(page.getByRole("article", { name: "Reseña de Valeria Ortiz" })).toBeVisible();
  await expect(page.getByText(titulo)).toBeVisible();
});
