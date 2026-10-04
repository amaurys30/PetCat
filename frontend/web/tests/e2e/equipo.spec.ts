import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { leerDeCorreo } from "./mailpit";

/**
 * P2 · Equipo contra la API de demo. Salud Animal 24h (Pro en prueba, sin límite de
 * empleados) para invitaciones, escalada y disponibilidad; un negocio Gratuito nuevo para el
 * límite del plan. Los enlaces de invitación se leen de Mailpit. Cada corrida deja datos
 * en petcat_demo (se limpian recargando la demo).
 */
const PASSWORD = "Petcat123!";
const SALUD_ANIMAL = 4;
const ENLACE = /\/invitacion\/([0-9a-f]{64})/;

const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function api<T>(
  request: APIRequestContext,
  metodo: "get" | "post" | "put" | "patch",
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

const login = async (request: APIRequestContext, email: string) =>
  (
    await api<{ access_token: string }>(request, "post", "/auth/login", undefined, {
      email,
      password: PASSWORD,
    })
  ).access_token;

const idRol = async (request: APIRequestContext, token: string, idNegocio: number, nombre: string) => {
  const roles = await api<{ id_rol: number; nombre: string }[]>(
    request,
    "get",
    `/negocios/${idNegocio}/roles`,
    token,
  );
  return roles.find((r) => r.nombre === nombre)!.id_rol;
};

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("invita desde el formulario, reenvía y agota los 4 correos de 24 horas", async ({ page, request }) => {
  test.setTimeout(60_000);
  const email = `equipo.${unico()}@petcat.test`;
  await entrar(page, "saludanimal@petcat.test");
  await page.goto(`/n/${SALUD_ANIMAL}/equipo/miembros`);

  await page.getByRole("button", { name: "Agregar miembro" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nombre *").fill("Invitada");
  await dialogo.getByLabel("Apellido *").fill("Prueba");
  await dialogo.getByLabel("Correo (para la invitación)").fill(email);
  await dialogo.getByRole("radio", { name: /Recepcionista/ }).click();
  await dialogo.getByRole("button", { name: "Guardar y enviar invitación" }).click();
  await expect(
    page.getByText(`Invitada Prueba quedó en el equipo. Invitación enviada a ${email}.`),
  ).toBeVisible();
  const primero = await leerDeCorreo(request, email, ENLACE);

  await page.getByLabel("Buscar miembro").fill(email);
  // Por el correo: las corridas anteriores dejan otras "Invitada Prueba".
  const fila = page.getByRole("row").filter({ hasText: email });
  await expect(fila.getByText(/Invitación pendiente · vence en/)).toBeVisible();
  await fila.getByRole("button", { name: "Reenviar (3 de 4)" }).click();
  await expect(page.getByText(/Puedes enviarle 2 más en 24 horas/)).toBeVisible();
  const segundo = await leerDeCorreo(request, email, ENLACE);
  expect(segundo).not.toBe(primero);

  // El enlace anterior quedó reemplazado.
  const anterior = await request.get(`/api/v1/invitaciones/${primero}`);
  expect(anterior.status()).toBe(409);

  await fila.getByRole("button", { name: "Reenviar (2 de 4)" }).click();
  await expect(fila.getByRole("button", { name: "Reenviar (1 de 4)" })).toBeVisible();
  await fila.getByRole("button", { name: "Reenviar (1 de 4)" }).click();
  // Cuarto correo en 24 horas: ya no se puede reenviar.
  await expect(fila.getByRole("button", { name: "Reenviar (0 de 4)" })).toBeDisabled();
});

test("plan Gratuito: en el límite pide Pro y el propietario se agrega sin ocupar cupo", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const email = `gratuito.${unico()}@petcat.test`;
  await api(request, "post", "/auth/register", undefined, {
    nombre: "Valentina",
    apellido: "Torres",
    email,
    password: PASSWORD,
    acepta_politica_datos: true,
    tipo_usuario: "negocio",
    canal: "panel_web",
  });
  const token = await login(request, email);
  const negocio = await api<{ id_negocio: number }>(request, "post", "/negocios", token, {
    nombre: `Equipo E2E ${unico()}`,
    tipo: "veterinaria",
    ciudad: "Sincelejo",
  });
  const id = negocio.id_negocio;
  const sede = await api<{ id_sucursal: number }>(request, "post", `/negocios/${id}/sucursales`, token, {
    nombre: "Sede Centro",
    direccion: "Cra 19 #22-35",
  });
  await api(request, "put", `/sucursales/${sede.id_sucursal}/horarios`, token, {
    horarios: [{ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }],
  });
  const recepcionista = await idRol(request, token, id, "Recepcionista");
  for (const nombre of ["Ana", "Luis", "Marta"]) {
    await api(request, "post", `/negocios/${id}/empleados`, token, {
      nombre,
      apellido: "Prueba",
      id_rol: recepcionista,
    });
  }

  await entrar(page, email);
  await page.goto(`/n/${id}/equipo/miembros`);
  await expect(
    page.getByText(/Plan Gratuito: 3 de 3 empleados\. El propietario no cuenta para el límite\./),
  ).toBeVisible();
  await page.getByRole("button", { name: "Agregar miembro" }).click();
  await expect(page.getByRole("dialog")).toContainText("Alcanzaste el límite de tu plan");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Agregarme como profesional" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Especialidad").fill("Medicina general");
  await dialogo.getByRole("button", { name: "Agregarme" }).click();
  await expect(dialogo.getByText("Ya eres parte del equipo")).toBeVisible();
  await dialogo.getByRole("button", { name: "Más tarde" }).click();

  await expect(page.getByRole("row", { name: /Valentina Torres/ }).getByText("Propietario")).toBeVisible();
  await expect(page.getByText(/Plan Gratuito: 3 de 3 empleados/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregarme como profesional" })).toBeHidden();
});

test("escalada: un coordinador invitado no asigna Administrador ni se toca a sí mismo", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const owner = await login(request, "saludanimal@petcat.test");
  const sufijo = unico();
  const rol = await api<{ id_rol: number; nombre: string }>(
    request,
    "post",
    `/negocios/${SALUD_ANIMAL}/roles`,
    owner,
    {
      nombre: `Coordinador ${sufijo}`,
      permisos_json: {
        empleados: ["ver", "crear", "editar", "eliminar"],
        roles: ["ver", "editar"],
        citas: ["ver"],
      },
    },
  );
  const email = `coordinador.${sufijo}@petcat.test`;
  const empleado = await api<{ id_empleado: number }>(
    request,
    "post",
    `/negocios/${SALUD_ANIMAL}/empleados`,
    owner,
    {
      nombre: "Diana",
      apellido: `Coordinadora${sufijo.slice(-4)}`,
      email,
      id_rol: rol.id_rol,
    },
  );
  await api(request, "post", `/empleados/${empleado.id_empleado}/invitacion`, owner);
  const enlace = await leerDeCorreo(request, email, ENLACE);
  await api(request, "post", `/invitaciones/${enlace}/aceptar`, undefined, {
    password: PASSWORD,
    acepta_politica_datos: true,
  });

  await entrar(page, email);
  await page.goto(`/n/${SALUD_ANIMAL}/equipo/miembros`);
  await page.getByRole("button", { name: "Agregar miembro" }).click();
  const admin = page.getByRole("dialog").getByRole("radio", { name: /Administrador/ });
  await expect(admin).toHaveAttribute("aria-disabled", "true");
  await expect(admin).toContainText("Tu rol no tiene todos los permisos de este rol");
  await page.keyboard.press("Escape");

  await page.getByLabel("Buscar miembro").fill(email);
  await page
    .getByRole("row")
    .filter({ hasText: email })
    .getByRole("button", { name: /Más acciones/ })
    .click();
  await expect(page.getByRole("menuitem", { name: /Desactivar/ })).toContainText(
    "No puedes desactivarte a ti mismo",
  );
  await page.keyboard.press("Escape");

  await page.goto(`/n/${SALUD_ANIMAL}/equipo/roles?rol=${rol.id_rol}`);
  await expect(page.getByText(/No puedes modificar tu propio rol\./)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Citas: ver" })).toBeDisabled();
});

test("disponibilidad: guarda la semana desde la sede y registra vacaciones", async ({ page, request }) => {
  test.setTimeout(60_000);
  const owner = await login(request, "saludanimal@petcat.test");
  const veterinario = await idRol(request, owner, SALUD_ANIMAL, "Veterinario");
  const apellido = `Disponible${unico().slice(-6)}`;
  const empleado = await api<{ id_empleado: number }>(
    request,
    "post",
    `/negocios/${SALUD_ANIMAL}/empleados`,
    owner,
    {
      nombre: "Pablo",
      apellido,
      id_rol: veterinario,
    },
  );

  await entrar(page, "saludanimal@petcat.test");
  await page.goto(`/n/${SALUD_ANIMAL}/equipo/${empleado.id_empleado}/disponibilidad`);
  await expect(page.getByRole("heading", { name: `Pablo ${apellido}` })).toBeVisible();
  await expect(
    page.getByText(/Sin horario propio: el profesional sigue el horario de la sede/),
  ).toBeVisible();
  await page.getByRole("button", { name: /Partir del horario de/ }).click();
  await page.getByRole("button", { name: "Guardar semana" }).click();
  await expect(page.getByText("Horario guardado", { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText(/La disponibilidad real es este horario recortado por el de la sede/),
  ).toBeVisible();

  await page.getByRole("button", { name: "+ Vacaciones" }).click();
  const dialogo = page.getByRole("dialog");
  const dentro = (dias: number) => {
    const d = new Date(Date.now() + dias * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  await dialogo.getByLabel("Desde *").fill(dentro(10));
  await dialogo.getByLabel("Hasta").fill(dentro(12));
  await dialogo.getByLabel("Motivo").fill("Vacaciones E2E");
  await dialogo.getByRole("button", { name: "Guardar vacaciones" }).click();
  await expect(dialogo).toBeHidden();
  const item = page.getByRole("listitem").filter({ hasText: "Vacaciones E2E" });
  await expect(item).toContainText("días completos");
  await expect(item).toContainText("Vacaciones");
});
