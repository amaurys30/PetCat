import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API, PASSWORD, token } from "./citas";

/**
 * P5.2 · Ficha de la mascota (C2) contra la API de demo, en Patitas. Solo lectura: no deja
 * datos. Max comparte su historial (ve el registro de Salud Animal, sin su nota interna);
 * Rocky no lo comparte (solo los registros de Patitas).
 */
const PROPIETARIO_PATITAS = "propietario@petcat.test";

interface Ids {
  idNegocio: number;
  idCliente: number;
  idMax: number;
  idCitaMax: number;
  fechaCitaMax: string;
}

async function ids(request: APIRequestContext): Promise<Ids> {
  const tk = await token(request, PROPIETARIO_PATITAS);
  const get = async <T>(url: string) =>
    (
      (await (await request.get(`${API}${url}`, { headers: { Authorization: `Bearer ${tk}` } })).json()) as {
        data: T;
      }
    ).data;
  const [patitas] = await get<{ id_negocio: number }[]>("/negocios/mios");
  const idNegocio = patitas!.id_negocio;
  const [cliente] = await get<{ id_usuario: number }[]>(
    `/negocios/${idNegocio}/clientes/buscar?email=cliente@petcat.test`,
  );
  const detalle = await get<{ mascotas: { id_mascota: number; nombre: string }[] }>(
    `/negocios/${idNegocio}/clientes/${cliente!.id_usuario}`,
  );
  const idMax = detalle.mascotas.find((m) => m.nombre === "Max")!.id_mascota;
  const [cita] = await get<{ id_cita: number; fecha: string }[]>(
    `/negocios/${idNegocio}/mascotas/${idMax}/citas?estado=completada`,
  );
  return {
    idNegocio,
    idCliente: cliente!.id_usuario,
    idMax,
    idCitaMax: cita!.id_cita,
    fechaCitaMax: cita!.fecha,
  };
}

async function entrar(page: Page, ruta: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_PATITAS);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  await page.goto(ruta);
}

test("desde Clientes: la ficha de Max con historial compartido, nota interna propia y carnet", async ({
  page,
  request,
}) => {
  const { idNegocio, idCliente } = await ids(request);
  await entrar(page, `/n/${idNegocio}/clientes?cliente=${idCliente}`);
  await page.getByRole("link", { name: "Ficha de Max" }).click();

  await expect(page.getByRole("heading", { name: /Max/ })).toBeVisible();
  await expect(page.getByText("Comparte su historial completo")).toBeVisible();
  const historial = page.getByRole("list", { name: "Historial médico" });
  await expect(historial.getByText(/Nota interna \(solo tu negocio\): Dueña muy puntual/)).toBeVisible();
  const ajeno = historial.getByRole("article").filter({ hasText: "Otro negocio · solo lectura" });
  await expect(ajeno.getByText(/Esguince leve/)).toBeVisible();
  await expect(ajeno.getByText(/Nota interna/)).toHaveCount(0);

  const carnet = page.getByRole("region", { name: "Carnet de vacunas" });
  await expect(carnet.getByRole("cell", { name: "Vencida", exact: true })).toBeVisible();
  await expect(carnet.getByRole("cell", { name: "Próxima", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Citas" }).click();
  await expect(page.getByRole("tabpanel", { name: "Citas" }).getByRole("row").nth(1)).toBeVisible();
});

test("Rocky no comparte: solo los registros de Patitas, con el aviso", async ({ page, request }) => {
  const { idNegocio } = await ids(request);
  await entrar(page, `/n/${idNegocio}/clientes`);
  await page.getByRole("combobox", { name: "Buscar cliente o mascota" }).fill("Rocky");
  await page.getByRole("list", { name: "Resultados de la búsqueda" }).getByRole("button").first().click();
  await page.getByRole("link", { name: "Ficha de Rocky" }).click();

  await expect(page.getByText("No comparte el historial de otros negocios", { exact: true })).toBeVisible();
  await expect(page.getByText(/ves solo los registros de tu negocio/)).toBeVisible();
  const historial = page.getByRole("list", { name: "Historial médico" });
  await expect(historial.getByText(/Dermatitis alérgica/)).toBeVisible();
  await expect(historial.getByText(/Gastroenteritis/)).toHaveCount(0);
  // Las vacunas se ven siempre, también las de otro negocio.
  await expect(
    page.getByRole("region", { name: "Carnet de vacunas" }).getByText("Antirrábica"),
  ).toBeVisible();
});

test("desde la agenda: Ver ficha médica en el detalle de la cita (B4)", async ({ page, request }) => {
  const { idNegocio, idMax, idCitaMax, fechaCitaMax } = await ids(request);
  await entrar(page, `/n/${idNegocio}/agenda?fecha=${fechaCitaMax}&cita=${idCitaMax}`);
  await page.getByRole("link", { name: "Ver ficha médica →" }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/mascotas/${idMax}$`));
  await expect(page.getByRole("heading", { name: /Max/ })).toBeVisible();
});
