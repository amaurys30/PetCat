import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API, citaDeHoy, contextoSalud, PASSWORD, PROPIETARIO_SALUD, token } from "./citas";

/**
 * P5.3 · Registro médico (C4) contra la API de demo, con archivos reales en Cloudinary
 * (backend-demo usa la carpeta petcat-demo). Los registros quedan en la demo (no se borran:
 * se limpian recargándola); los archivos se quitan al final para no dejarlos en Cloudinary.
 */
const PROPIETARIO_PATITAS = "propietario@petcat.test";
const unico = () => `${Date.now()}`.slice(-7);

// PNG de 1×1 y un PDF mínimo válidos: la API revisa el contenido, no solo la extensión.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 72 72]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

async function entrar(page: Page, email: string, ruta: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  await page.goto(ruta);
}

interface Registro {
  id_historial: number;
  diagnostico: string | null;
  archivos: { id_archivo?: number; url: string }[];
}

async function maxDePatitas(request: APIRequestContext) {
  const tk = await token(request, PROPIETARIO_PATITAS);
  const get = async <T>(url: string) =>
    (
      (await (await request.get(`${API}${url}`, { headers: { Authorization: `Bearer ${tk}` } })).json()) as {
        data: T;
      }
    ).data;
  const [patitas] = await get<{ id_negocio: number }[]>("/negocios/mios");
  const [cliente] = await get<{ id_usuario: number }[]>(
    `/negocios/${patitas!.id_negocio}/clientes/buscar?email=cliente@petcat.test`,
  );
  const detalle = await get<{ mascotas: { id_mascota: number; nombre: string }[] }>(
    `/negocios/${patitas!.id_negocio}/clientes/${cliente!.id_usuario}`,
  );
  const idMax = detalle.mascotas.find((m) => m.nombre === "Max")!.id_mascota;
  const buscar = async (diagnostico: string) =>
    (await get<Registro[]>(`/negocios/${patitas!.id_negocio}/mascotas/${idMax}/historial?limit=50`)).find(
      (r) => r.diagnostico === diagnostico,
    );
  const quitarArchivos = async (registro: Registro | undefined) => {
    for (const a of registro?.archivos ?? []) {
      if (a.id_archivo)
        await request.delete(`${API}/historial/${registro!.id_historial}/archivos/${a.id_archivo}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
    }
  };
  return { idNegocio: patitas!.id_negocio, idMax, buscar, quitarArchivos };
}

test("crea un registro de control con una imagen y un PDF privados, lo abre y lo edita", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await maxDePatitas(request);
  const diagnostico = `Displasia leve e2e ${unico()}`;
  try {
    await entrar(page, PROPIETARIO_PATITAS, `/n/${ctx.idNegocio}/clientes/mascotas/${ctx.idMax}`);
    await page.getByRole("button", { name: "Registro médico" }).click();
    const d = page.getByRole("dialog", { name: "Nuevo registro médico · Max" });
    await d.getByRole("radio", { name: "Control" }).click();
    await d.getByRole("combobox", { name: "Vincular a una cita" }).click();
    await page.getByRole("option").nth(1).click();
    await d.getByLabel("Diagnóstico").fill(diagnostico);
    await d.getByLabel("Peso (kg)").fill("28,7");
    await d.getByLabel(/Arrastra archivos/).setInputFiles([
      { name: "radiografia.png", mimeType: "image/png", buffer: PNG },
      { name: "examen.pdf", mimeType: "application/pdf", buffer: PDF },
    ]);
    await d.getByRole("button", { name: "Guardar registro" }).click();
    await expect(page.getByText("Registro médico guardado")).toBeVisible({ timeout: 30_000 });

    const tarjeta = page.getByRole("article").filter({ hasText: diagnostico });
    await expect(tarjeta.getByText("Control", { exact: true })).toBeVisible();
    await expect(tarjeta.getByRole("button", { name: "radiografia.png" })).toBeVisible();
    await expect(tarjeta.getByRole("button", { name: "examen.pdf" })).toBeVisible();

    // La URL firmada abre el archivo privado (y no se guarda en el panel).
    const [pestana] = await Promise.all([
      page.waitForEvent("popup"),
      tarjeta.getByRole("button", { name: "radiografia.png" }).click(),
    ]);
    await pestana.waitForLoadState();
    // URL de descarga firmada de Cloudinary (privada, vence en 15 minutos).
    expect(pestana.url()).toMatch(/^https:\/\/api\.cloudinary\.com\/.+\/download\?.*signature=/);
    expect((await request.get(pestana.url())).status()).toBe(200);
    await pestana.close();

    // Editar deja constancia de quién y cuándo.
    await tarjeta.getByRole("button", { name: "Editar" }).click();
    const editar = page.getByRole("dialog", { name: "Editar registro médico · Max" });
    await editar.getByLabel("Indicaciones para el dueño").fill("Control en un mes");
    await editar.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Registro médico actualizado")).toBeVisible();
    await expect(tarjeta.getByText(/^Editado por Laura Martínez · /)).toBeVisible();
  } finally {
    await ctx.quitarArchivos(await ctx.buscar(diagnostico));
  }
});

test("B8: completar con la casilla abre C4 con la cita y el registro queda en el detalle", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  const cita = await citaDeHoy(request, ctx);
  test.skip(!cita, "Es el último cuarto de hora del día: ya no quedan horarios hoy");
  const diagnostico = `Sano e2e ${unico()}`;

  await entrar(page, PROPIETARIO_SALUD, `/n/${ctx.idNegocio}/agenda?cita=${cita!.id_cita}`);
  const detalle = page.getByRole("dialog", { name: `Cita #${cita!.id_cita}` });
  await detalle.getByRole("button", { name: "Iniciar atención" }).click();
  await expect(page.getByText("Cita en curso")).toBeVisible();
  await detalle.getByRole("button", { name: "Completar" }).click();
  const completar = page.getByRole("dialog", { name: "Completar cita" });
  await completar.getByRole("checkbox", { name: /Crear el registro médico al terminar/ }).check();
  await completar.getByRole("button", { name: "Completar cita" }).click();
  await expect(page.getByText("Cita completada")).toBeVisible();

  const c4 = page.getByRole("dialog", { name: /^Nuevo registro médico · / });
  await expect(c4.getByRole("combobox", { name: "Vincular a una cita" })).toContainText("Desparasitación");
  await c4.getByLabel("Diagnóstico").fill(diagnostico);
  await c4.getByRole("button", { name: "Guardar registro" }).click();
  await expect(page.getByText("Registro médico guardado")).toBeVisible();

  await expect(
    page.getByRole("dialog", { name: `Cita #${cita!.id_cita}` }).getByText(/^Registro médico: Consulta/),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: `Cita #${cita!.id_cita}` })
    .getByRole("link", { name: "Ver ficha médica →" })
    .click();
  await expect(page.getByRole("article").filter({ hasText: diagnostico })).toBeVisible();
});
