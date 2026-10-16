import { expect, test, type Locator, type Page } from "@playwright/test";
import { API, cancelarSiActiva, contextoSalud, estadoDe, PASSWORD, PROPIETARIO_SALUD, token } from "./citas";
import { leerDeCorreo } from "./mailpit";

/**
 * P4.3 · Nueva cita (B5) y registro de cliente sin app (C3) contra la API de demo, en Salud
 * Animal. Cada prueba cancela al final la cita que creó. Los clientes nuevos quedan en la
 * demo con teléfonos y correos únicos (se limpian recargándola).
 */
const unico = () => `${Date.now()}`.slice(-7);

async function entrar(page: Page, idNegocio: number) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  await page.goto(`/n/${idNegocio}/agenda`);
  await page.getByRole("button", { name: "Nueva cita" }).click();
  return page.getByRole("dialog", { name: "Nueva cita" });
}

/** Servicio, la sede Norte, mañana y el primer horario libre; devuelve la cita creada (id de la URL). */
async function completarYAgendar(page: Page, d: Locator) {
  await d.getByRole("combobox", { name: "Servicio" }).click();
  await page.getByRole("option", { name: /^Consulta especializada/ }).click();
  const sede = d.getByRole("combobox", { name: "Sede" });
  if (await sede.isVisible()) {
    await sede.click();
    await page.getByRole("option", { name: "Sede Norte" }).click();
  }
  await d.getByRole("radiogroup", { name: "Fecha" }).getByRole("radio").nth(1).click();
  await d.getByRole("radiogroup", { name: "Horarios libres" }).getByRole("radio").first().click();
  await d.getByRole("button", { name: "Agendar cita (queda confirmada)" }).click();
  await expect(page.getByText(/^Cita agendada y confirmada:/)).toBeVisible();
  await expect(page).toHaveURL(/cita=\d+/);
  return Number(new URL(page.url()).searchParams.get("cita"));
}

test("agenda para un cliente existente buscado por teléfono", async ({ page, request }) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  let idCita: number | null = null;
  try {
    const d = await entrar(page, ctx.idNegocio);
    await d.getByLabel("Buscar cliente").fill("300 666 0101");
    await d.getByRole("button", { name: "Buscar" }).click();
    await d
      .getByRole("list", { name: "Clientes encontrados" })
      .getByRole("button", { name: /Camilo Torres/ })
      .click();
    await d.getByRole("radiogroup", { name: "Mascota" }).getByRole("radio").first().click();
    idCita = await completarYAgendar(page, d);
    await expect(page.getByRole("dialog", { name: `Cita #${idCita}` })).toBeVisible();
    expect(await estadoDe(request, ctx, idCita)).toBe("confirmada");
  } finally {
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});

test("registra un cliente sin cuenta (sin correo) y le agenda; la búsqueda por teléfono lo encuentra", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const telefono = `310${unico()}`;
  let idCita: number | null = null;
  try {
    const d = await entrar(page, ctx.idNegocio);
    await d.getByLabel("Buscar cliente").fill(telefono);
    await d.getByRole("button", { name: "Buscar" }).click();
    await expect(d.getByText("Nadie tiene ese teléfono o correo en PetCat.")).toBeVisible();
    await d.getByRole("button", { name: "Registrar cliente sin app" }).click();

    const c3 = page.getByRole("dialog", { name: "Registrar cliente sin app" });
    await expect(c3.getByLabel("Teléfono *")).toHaveValue(telefono);
    await expect(c3.getByText(/cliente sin cuenta/)).toBeVisible();
    await c3.getByLabel("Nombre *").first().fill("Jorge");
    await c3.getByLabel("Apellido *").fill("Prueba e2e");
    await c3.getByLabel("Nombre *").nth(1).fill("Toby");
    await c3.getByRole("checkbox").check();
    await c3.getByRole("button", { name: "Registrar y agendar cita" }).click();
    await expect(page.getByText(/Jorge quedó registrado sin cuenta/)).toBeVisible();

    await expect(d.getByText(/sin cuenta/)).toBeVisible();
    await expect(d.getByRole("radio", { name: "Toby" })).toHaveAttribute("aria-checked", "true");
    idCita = await completarYAgendar(page, d);
    await expect(page.getByRole("dialog", { name: `Cita #${idCita}` }).getByText("Sin cuenta")).toBeVisible();

    const res = await request.get(`${API}/negocios/${ctx.idNegocio}/clientes/buscar?telefono=${telefono}`, {
      headers: { Authorization: `Bearer ${await token(request, PROPIETARIO_SALUD)}` },
    });
    const [encontrado] = ((await res.json()) as { data: { email: string | null; nombre: string }[] }).data;
    expect(encontrado).toMatchObject({ nombre: "Jorge", email: null });
  } finally {
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});

test("registra un cliente con correo: recibe la bienvenida con el enlace para crear su contraseña", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const correo = `cliente.e2e.${unico()}@petcat.test`;
  let idCita: number | null = null;
  try {
    const d = await entrar(page, ctx.idNegocio);
    await d.getByRole("button", { name: "Registrar cliente sin app" }).click();
    const c3 = page.getByRole("dialog", { name: "Registrar cliente sin app" });
    await c3.getByLabel("Nombre *").first().fill("Marta");
    await c3.getByLabel("Apellido *").fill("Prueba e2e");
    await c3.getByLabel("Correo electrónico").fill(correo);
    await expect(c3.getByText(/correo de bienvenida/)).toBeVisible();
    await c3.getByLabel("Nombre *").nth(1).fill("Copo");
    await c3.getByRole("radio", { name: "Gato" }).click();
    await c3.getByRole("checkbox").check();
    await c3.getByRole("button", { name: "Registrar y agendar cita" }).click();
    await expect(page.getByText(/Marta quedó registrado. Le enviamos el correo de bienvenida/)).toBeVisible();

    const enlace = await leerDeCorreo(request, correo, /(\/crear-password\/[0-9a-f]{64})/);
    expect(enlace).toMatch(/^\/crear-password\//);
    idCita = await completarYAgendar(page, d);
  } finally {
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});
