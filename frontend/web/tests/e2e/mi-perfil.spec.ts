import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * E6 contra la API de demo con una cuenta nueva y su negocio ya configurado (sede y horario).
 * Cambio de contraseña con dos navegadores: el que cambia sigue (y su otra pestaña también,
 * porque comparten la sesión); el otro dispositivo queda fuera en su siguiente petición.
 */
const api = async <T>(
  request: APIRequestContext,
  metodo: "post" | "put",
  url: string,
  token: string | null,
  data: object,
) => {
  const res = await request[metodo](`/api/v1${url}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(res.ok(), `${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
};

async function cuentaConNegocio(request: APIRequestContext, email: string, password: string) {
  await api(request, "post", "/auth/register", null, {
    nombre: "Valentina",
    apellido: "Torres",
    email,
    password,
    acepta_politica_datos: true,
    tipo_usuario: "negocio",
    canal: "panel_web",
  });
  const { access_token } = await api<{ access_token: string }>(request, "post", "/auth/login", null, {
    email,
    password,
  });
  const { id_negocio } = await api<{ id_negocio: number }>(request, "post", "/negocios", access_token, {
    nombre: "Patitas Perfil",
    tipo: "veterinaria",
  });
  const { id_sucursal } = await api<{ id_sucursal: number }>(
    request,
    "post",
    `/negocios/${id_negocio}/sucursales`,
    access_token,
    { nombre: "Sede principal", direccion: "Cra 19 #22-35" },
  );
  await api(request, "put", `/sucursales/${id_sucursal}/horarios`, access_token, {
    horarios: [{ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }],
  });
  return id_negocio;
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
}

test("cambiar la contraseña cierra los otros dispositivos y no las pestañas propias", async ({
  browser,
  page,
  request,
}) => {
  // Dos navegadores, dos pestañas y cinco inicios de sesión: con la suite en paralelo pasa de 30 s.
  test.setTimeout(60_000);
  const email = `perfil.${Date.now()}@petcat.test`;
  const id = await cuentaConNegocio(request, email, "Patitas123");

  await entrar(page, email, "Patitas123");
  const otraPestana = await page.context().newPage();
  await otraPestana.goto(`/n/${id}/dashboard`);
  await expect(otraPestana.getByText("Valentina Torres")).toBeVisible();

  const otroDispositivo = await browser.newContext();
  const telefono = await otroDispositivo.newPage();
  await entrar(telefono, email, "Patitas123");

  // El nombre que cambia una pestaña llega a la otra.
  await page.goto(`/n/${id}/mi-perfil`);
  await page.getByLabel("Nombre *").fill("Valeria");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(otraPestana.getByText("Valeria Torres")).toBeVisible();

  await page.getByLabel("Contraseña actual").fill("Patitas123");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Nueva5678");
  await page.getByLabel("Confirmar nueva contraseña").fill("Nueva5678");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText(/Se cerraron tus sesiones en otros dispositivos/)).toBeVisible();

  // Las dos pestañas de este navegador siguen; el otro dispositivo vuelve al login.
  await otraPestana.reload();
  await expect(otraPestana).toHaveURL(new RegExp(`/n/${id}/dashboard$`));
  await telefono.goto(`/n/${id}/configuracion`);
  await expect(telefono).toHaveURL(/\/login/);

  await entrar(telefono, email, "Nueva5678");
  await otroDispositivo.close();
});
