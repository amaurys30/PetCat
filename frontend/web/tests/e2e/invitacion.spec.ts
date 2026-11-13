import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { leerDeCorreo } from "./mailpit";

/**
 * A4 contra la API de demo. Salud Animal 24h (Pro en prueba, sin límite de empleados)
 * crea un empleado y lo invita; el enlace se lee del correo en Mailpit, adonde envía la
 * API de demo. Cada corrida usa correos nuevos.
 */
const PASSWORD = "Petcat123!";

const api = async <T>(
  request: APIRequestContext,
  metodo: "get" | "post",
  url: string,
  token?: string,
  data?: object,
) => {
  const res = await request[metodo](`/api/v1${url}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(res.ok(), `${metodo.toUpperCase()} ${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
};

/** El negocio invita a `email` y devuelve el token del enlace. */
async function invitar(request: APIRequestContext, email: string, nombre: string): Promise<string> {
  const { access_token } = await api<{ access_token: string }>(request, "post", "/auth/login", undefined, {
    email: "saludanimal@petcat.test",
    password: PASSWORD,
  });
  const roles = await api<{ id_rol: number; nombre: string }[]>(
    request,
    "get",
    "/negocios/4/roles",
    access_token,
  );
  const rol = roles.find((r) => r.nombre === "Recepcionista") ?? roles[0]!;
  const empleado = await api<{ id_empleado: number }>(
    request,
    "post",
    "/negocios/4/empleados",
    access_token,
    {
      id_rol: rol.id_rol,
      nombre,
      apellido: "Prueba",
      email,
    },
  );
  await api(request, "post", `/empleados/${empleado.id_empleado}/invitacion`, access_token);
  return leerDeCorreo(request, email, /\/invitacion\/([0-9a-f]{64})/);
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("sin cuenta: crea la cuenta al aceptar y entra al negocio", async ({ page, request }) => {
  const email = `invitado.${Date.now()}@petcat.test`;
  const token = await invitar(request, email, "Carlos");

  await page.goto(`/invitacion/${token}`);
  await expect(page.getByRole("heading", { name: "Centro Veterinario Salud Animal 24h" })).toBeVisible();
  await expect(page.getByText(`Invitación para ${email}`)).toBeVisible();
  await expect(page.getByLabel("Nombre")).toHaveValue("Carlos");
  await page.getByLabel("Contraseña", { exact: true }).fill("Carlos1234");
  await page.getByLabel(/Acepto la política/).check();
  await page.getByRole("button", { name: "Aceptar y entrar" }).click();

  await expect(page).toHaveURL(/\/n\/4\/\w+/);
  await expect(page.getByRole("button", { name: /Centro Veterinario Salud Animal 24h/ })).toBeVisible();

  // El enlace ya se usó.
  await page.goto(`/invitacion/${token}`);
  await expect(page.getByRole("heading", { name: "Esta invitación ya no se puede usar" })).toBeVisible();
});

test("con cuenta y otra sesión abierta: avisa, valida la contraseña y cambia de cuenta", async ({
  context,
  page,
  request,
}) => {
  const email = `existente.${Date.now()}@petcat.test`;
  await api(request, "post", "/auth/register", undefined, {
    nombre: "Diana",
    apellido: "Prueba",
    email,
    password: PASSWORD,
    acepta_politica_datos: true,
  });
  const token = await invitar(request, email, "Diana");

  await entrar(page, "propietario@petcat.test");
  const otraPestana = await context.newPage();
  await otraPestana.goto("/panel");
  await expect(otraPestana).toHaveURL(/\/n\/1\/\w+/);

  await page.goto(`/invitacion/${token}`);
  await expect(page.getByText("Tienes la sesión iniciada como propietario@petcat.test")).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toHaveValue(email);

  await page.getByLabel("Contraseña actual", { exact: true }).fill("NoEsLaClave1");
  await page.getByRole("button", { name: "Aceptar y entrar" }).click();
  await expect(page.getByText("Contraseña incorrecta")).toBeVisible();

  await page.getByLabel("Contraseña actual", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Aceptar y entrar" }).click();
  await expect(page).toHaveURL(/\/n\/4\/\w+/);

  // Quedó la cuenta invitada: con solo ese negocio, "/panel" entra directo a él.
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/n\/4\/\w+/);

  // La otra pestaña soltó la sesión de la propietaria y tomó la nueva.
  await expect(otraPestana).toHaveURL(/\/n\/4\/\w+/);
});
