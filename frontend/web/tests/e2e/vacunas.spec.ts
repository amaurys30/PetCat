import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API, PASSWORD, token } from "./citas";

/**
 * P5.4 · Vacunas (C5) contra la API de demo, con el comprobante real en Cloudinary (carpeta
 * petcat-demo). La vacuna y el registro quedan en la demo (no se borran: se limpian
 * recargándola); el comprobante se quita al final para no dejarlo en Cloudinary.
 */
const PROPIETARIO_PATITAS = "propietario@petcat.test";
const unico = () => `${Date.now()}`.slice(-7);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function entrar(page: Page, ruta: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_PATITAS);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  await page.goto(ruta);
}

async function maxDePatitas(request: APIRequestContext) {
  const tk = await token(request, PROPIETARIO_PATITAS);
  const auth = { Authorization: `Bearer ${tk}` };
  const get = async <T>(url: string) =>
    ((await (await request.get(`${API}${url}`, { headers: auth })).json()) as { data: T }).data;
  const [patitas] = await get<{ id_negocio: number }[]>("/negocios/mios");
  const [cliente] = await get<{ id_usuario: number }[]>(
    `/negocios/${patitas!.id_negocio}/clientes/buscar?email=cliente@petcat.test`,
  );
  const detalle = await get<{ mascotas: { id_mascota: number; nombre: string }[] }>(
    `/negocios/${patitas!.id_negocio}/clientes/${cliente!.id_usuario}`,
  );
  const idMax = detalle.mascotas.find((m) => m.nombre === "Max")!.id_mascota;
  const quitarComprobante = async (lote: string) => {
    const vacunas = await get<{ id_vacuna: number; lote: string | null; tiene_comprobante: boolean }[]>(
      `/negocios/${patitas!.id_negocio}/mascotas/${idMax}/vacunas`,
    );
    const vacuna = vacunas.find((v) => v.lote === lote);
    if (vacuna?.tiene_comprobante)
      await request.delete(`${API}/vacunas/${vacuna.id_vacuna}/comprobante`, { headers: auth });
  };
  /** Una dosis de hace 30 días, para que la nueva la reemplace (sin depender de otras corridas). */
  const dosisAnterior = async (nombre: string) => {
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });
    const res = await request.post(`${API}/negocios/${patitas!.id_negocio}/vacunas`, {
      headers: auth,
      data: { id_mascota: idMax, nombre_vacuna: nombre, fecha_aplicacion: hace30 },
    });
    expect(res.status()).toBe(201);
  };
  return { idNegocio: patitas!.id_negocio, idMax, quitarComprobante, dosisAnterior };
}

test("desde un registro de vacunación: registra la vacuna con comprobante, la dosis anterior pasa a No aplica y la edita", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await maxDePatitas(request);
  const id = unico();
  const lote = `RB-${id}`;
  // Nombre único por corrida: la demo acumula las vacunas de corridas anteriores.
  const vacuna = `Antirrábica e2e ${id}`;
  await ctx.dosisAnterior(vacuna);
  try {
    await entrar(page, `/n/${ctx.idNegocio}/clientes/mascotas/${ctx.idMax}`);
    await page.getByRole("button", { name: "Registro médico" }).click();
    const c4 = page.getByRole("dialog", { name: "Nuevo registro médico · Max" });
    await c4.getByRole("radio", { name: "Vacunación" }).click();
    await c4.getByLabel("Motivo de consulta").fill("Refuerzo antirrábico");
    await c4.getByRole("button", { name: "Guardar registro" }).click();
    await c4.getByRole("button", { name: /Registrar también en el carnet/ }).click();

    const c5 = page.getByRole("dialog", { name: "Registrar vacuna · Max" });
    await expect(c5.getByRole("combobox", { name: "Vincular a registro médico" })).toBeDisabled();
    await c5.getByLabel("Vacuna *").fill(vacuna);
    // La dosis de hace 30 días pasa a "No aplica".
    await expect(c5.getByText(`La dosis anterior de ${vacuna}`, { exact: false })).toBeVisible();
    await c5.getByLabel("Lote").fill(lote);
    await c5.getByLabel("Laboratorio").fill("Zoetis");
    await c5
      .getByLabel(/Subir comprobante/)
      .setInputFiles({ name: "carnet.png", mimeType: "image/png", buffer: PNG });
    await c5.getByRole("button", { name: "Guardar vacuna" }).click();
    await expect(page.getByText("Vacuna registrada en el carnet")).toBeVisible({ timeout: 30_000 });

    // En el carnet, la vigente es la nueva (al día); la anterior solo con "Ver dosis anteriores".
    await page.getByRole("tab", { name: "Vacunas" }).click();
    const panel = page.getByRole("tabpanel", { name: "Vacunas" });
    const fila = panel.getByRole("row").filter({ hasText: lote });
    await expect(fila.getByText("Al día")).toBeVisible();
    await expect(fila.getByRole("button", { name: "Comprobante" })).toBeVisible();
    await panel.getByRole("switch").click();
    await expect(panel.getByRole("row").filter({ hasText: vacuna }).getByText("No aplica")).toBeVisible();

    // Editar la próxima dosis avisa que se reprograman los recordatorios y deja el rastro.
    await fila.getByRole("button", { name: `Editar ${vacuna}` }).click();
    const editar = page.getByRole("dialog", { name: "Editar vacuna · Max" });
    const proxima = new Date(Date.now() + 300 * 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });
    await editar.getByLabel("Próxima dosis").fill(proxima);
    await expect(
      editar.getByText(/Los recordatorios del dueño se reprogramarán con la nueva fecha/),
    ).toBeVisible();
    await editar.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Vacuna actualizada")).toBeVisible();
    await expect(fila.getByText(/^Editado por Laura Martínez · /)).toBeVisible();
  } finally {
    await ctx.quitarComprobante(lote);
  }
});

test("una vacuna registrada por el dueño se ve marcada y no se edita", async ({ page, request }) => {
  const ctx = await maxDePatitas(request);
  await entrar(page, `/n/${ctx.idNegocio}/clientes/mascotas/${ctx.idMax}?pestana=vacunas`);
  const panel = page.getByRole("tabpanel", { name: "Vacunas" });
  await panel.getByRole("switch").click();
  // La primera antirrábica del seed la registró el dueño (con comprobante externo).
  const delDueno = panel.getByRole("row").filter({ has: page.getByText("Dueño", { exact: true }) });
  await expect(delDueno.first()).toBeVisible();
  await expect(delDueno.first().getByRole("button", { name: /^Editar/ })).toHaveCount(0);
});
