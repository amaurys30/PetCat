import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * P6.5 · Administración contra la API de demo: el super admin del seed asigna Pro a un negocio
 * Gratuito creado por la prueba (no toca los del seed), el historial dice quién lo asignó y el
 * propietario ve el plan nuevo. Deja cuentas y negocios en petcat_demo (se limpian recargando la demo).
 */
const PASSWORD = "Petcat123!";
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function api<T>(
  request: APIRequestContext,
  metodo: "post" | "put",
  url: string,
  token?: string,
  data?: object,
): Promise<T> {
  const res = await request[metodo](`/api/v1${url}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(res.ok(), `${metodo.toUpperCase()} ${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

async function negocioGratuito(request: APIRequestContext) {
  const email = `admin.e2e.${unico()}@petcat.test`;
  await api(request, "post", "/auth/register", undefined, {
    nombre: "Marta",
    apellido: "Prueba",
    email,
    password: PASSWORD,
    acepta_politica_datos: true,
    tipo_usuario: "negocio",
    canal: "panel_web",
  });
  const { access_token: token } = await api<{ access_token: string }>(
    request,
    "post",
    "/auth/login",
    undefined,
    {
      email,
      password: PASSWORD,
    },
  );
  const nombre = `Admin E2E ${unico()}`;
  const { id_negocio: id } = await api<{ id_negocio: number }>(request, "post", "/negocios", token, {
    nombre,
    tipo: "guarderia",
    ciudad: "Sincelejo",
  });
  const sede = await api<{ id_sucursal: number }>(request, "post", `/negocios/${id}/sucursales`, token, {
    nombre: "Sede Centro",
    direccion: "Cra 19 #22-35",
  });
  await api(request, "put", `/sucursales/${sede.id_sucursal}/horarios`, token, {
    horarios: [{ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }],
  });
  return { email, id, nombre };
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("el super admin asigna Pro a un negocio; el historial dice quién y el propietario lo ve", async ({
  browser,
  request,
}) => {
  test.setTimeout(90_000);
  const negocio = await negocioGratuito(request);

  const contextoAdmin = await browser.newContext();
  const page = await contextoAdmin.newPage();
  await entrar(page, "admin@petcat.test");
  // Sin negocios propios, entra directo a la administración.
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel("Buscar negocio").fill(negocio.nombre);
  const tabla = page.getByRole("table", { name: "Negocios de PetCat" });
  const fila = tabla.getByRole("row", { name: new RegExp(negocio.nombre) });
  await expect(fila.getByText("Gratuito")).toBeVisible();
  await fila.getByRole("button", { name: negocio.nombre }).click();

  await expect(page.getByRole("heading", { name: `Asignar plan · ${negocio.nombre}` })).toBeVisible();
  await page.getByRole("radio", { name: "Pro" }).click();
  await page.getByLabel("Notas").fill("Pago por transferencia · e2e");
  await page.getByRole("button", { name: "Asignar plan" }).click();
  await expect(page.getByText(`Plan Pro asignado a ${negocio.nombre}`)).toBeVisible();
  await expect(fila.getByText("Pro", { exact: true })).toBeVisible();
  const historial = page.getByRole("list", { name: `Historial de ${negocio.nombre}` });
  await expect(historial.getByText(/^Admin PetCat · super admin/)).toBeVisible();
  await expect(historial.getByText("Pago por transferencia · e2e")).toBeVisible();
  await expect(historial.getByText(/^Automática/)).toBeVisible();
  await contextoAdmin.close();

  // El propietario ve el plan nuevo en E4; /admin no existe para él.
  const contextoDueno = await browser.newContext();
  const dueno = await contextoDueno.newPage();
  await entrar(dueno, negocio.email);
  await dueno.goto(`/n/${negocio.id}/suscripcion`);
  const actual = dueno.getByRole("heading", { name: "Plan actual" }).locator("..");
  await expect(actual.getByText("Pro", { exact: true })).toBeVisible();
  await dueno.goto("/admin");
  await expect(dueno.getByRole("heading", { name: "Administración PetCat" })).toHaveCount(0);
  await expect(dueno.getByText(/No encontr/i).first()).toBeVisible();
  await contextoDueno.close();
});
