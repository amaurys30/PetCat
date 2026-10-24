import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * P6.1 · Suscripción contra la API de demo. Cada prueba registra a una propietaria con un
 * negocio Gratuito nuevo (la prueba Pro se usa una sola vez por negocio). Dejan cuentas y
 * negocios en petcat_demo (se limpian recargando la demo).
 */
const PASSWORD = "Petcat123!";

const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function api<T>(
  request: APIRequestContext,
  metodo: "get" | "post" | "put",
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

/** Propietaria nueva con un negocio Gratuito configurado (sede con horario) y `empleados` miembros. */
async function negocioGratuito(request: APIRequestContext, empleados = 0) {
  const email = `suscripcion.${unico()}@petcat.test`;
  await api(request, "post", "/auth/register", undefined, {
    nombre: "Valentina",
    apellido: "Torres",
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
  const { id_negocio: id } = await api<{ id_negocio: number }>(request, "post", "/negocios", token, {
    nombre: `Suscripción E2E ${unico()}`,
    tipo: "veterinaria",
    ciudad: "Sincelejo",
  });
  const sede = await api<{ id_sucursal: number }>(request, "post", `/negocios/${id}/sucursales`, token, {
    nombre: "Sede Centro",
    direccion: "Cra 19 #22-35",
  });
  await api(request, "put", `/sucursales/${sede.id_sucursal}/horarios`, token, {
    horarios: [{ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }],
  });
  if (empleados > 0) {
    const roles = await api<{ id_rol: number; nombre: string }[]>(
      request,
      "get",
      `/negocios/${id}/roles`,
      token,
    );
    const recepcionista = roles.find((r) => r.nombre === "Recepcionista")!.id_rol;
    for (let i = 0; i < empleados; i++) {
      await api(request, "post", `/negocios/${id}/empleados`, token, {
        nombre: `Miembro ${i + 1}`,
        apellido: "Prueba",
        id_rol: recepcionista,
      });
    }
  }
  return { email, id };
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("E4: la propietaria ve su plan y su uso, y activa la prueba Pro", async ({ page, request }) => {
  test.setTimeout(60_000);
  const { email, id } = await negocioGratuito(request);
  await entrar(page, email);
  await page.goto(`/n/${id}/suscripcion`);

  const actual = page.getByRole("heading", { name: "Plan actual" }).locator("..");
  await expect(actual.getByText("Gratuito", { exact: true })).toBeVisible();
  await expect(actual.getByText(/^Sin vencimiento/)).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Sedes" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("region", { name: "Planes" }).getByText("Recomendado")).toBeVisible();
  // El seed configura el correo de soporte.
  await expect(
    page.getByText(/El pago en línea llega pronto\. Para contratar hoy escríbenos a/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Probar Pro 14 días" }).click();
  const dialogo = page.getByRole("dialog", { name: "¿Activar la prueba del plan Pro?" });
  await dialogo.getByRole("button", { name: "Activar prueba" }).click();

  await expect(page.getByText("Prueba del plan Pro activada: quedan 14 días")).toBeVisible();
  await expect(actual.getByText("Pro", { exact: true })).toBeVisible();
  await expect(actual.getByText("En prueba · quedan 14 días")).toBeVisible();
  await expect(page.getByRole("button", { name: /Probar/ })).toHaveCount(0);
  // El menú lateral toma el plan nuevo.
  await expect(page.getByText("Plan Pro", { exact: true })).toBeVisible();
  await expect(page.getByText("Prueba Pro: quedan 14 días")).toBeVisible();
});

test("en el límite de empleados, la prueba se activa desde el diálogo y desbloquea el alta", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const { email, id } = await negocioGratuito(request, 3);
  await entrar(page, email);
  await page.goto(`/n/${id}/equipo/miembros`);
  await expect(page.getByText(/Plan Gratuito: 3 de 3 empleados/)).toBeVisible();

  await page.getByRole("button", { name: "Agregar miembro" }).click();
  const limite = page.getByRole("dialog", { name: "Alcanzaste el límite de tu plan" });
  await limite.getByRole("button", { name: "Probar Pro 14 días" }).click();
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByText("Prueba del plan Pro activada: quedan 14 días")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/n/${id}/equipo/miembros$`));

  await expect(page.getByText(/Plan Gratuito: 3 de 3 empleados/)).toBeHidden();
  await page.getByRole("button", { name: "Agregar miembro" }).click();
  await expect(page.getByRole("dialog", { name: /Agregar miembro/ })).toBeVisible();
});
