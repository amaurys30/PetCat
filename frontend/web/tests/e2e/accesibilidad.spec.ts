import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import {
  API,
  contextoSalud,
  PASSWORD,
  PROPIETARIO_SALUD,
  reservaPendiente,
  cancelarSiActiva,
  token,
} from "./citas";

/**
 * P7 · Accesibilidad con axe (WCAG 2.1 A y AA) en las pantallas principales, contra la API de
 * demo. Una sesión por grupo (la abre el beforeAll; si una prueba falla, Playwright reinicia el
 * proceso y la vuelve a abrir, así que cada pantalla se analiza aunque falle la anterior): cada
 * prueba navega a su pantalla, espera a que terminen los esqueletos y analiza la página.
 *
 * `CONOCIDAS`: reglas que fallan hoy y están en el informe de P7, pendientes de corregir. La
 * prueba falla con cualquier regla nueva, y también si una conocida ya no aparece (para
 * quitarla de la lista al corregirla). El detalle de cada análisis queda adjunto al reporte.
 */
const CONOCIDAS: Record<string, string[]> = {
  "A1 login": ["color-contrast"],
  "A2 recuperar contraseña": ["color-contrast"],
  "A7 crear cuenta": ["color-contrast"],
  "B1 dashboard": ["aria-hidden-focus", "color-contrast"],
  "B3 agenda semanal": ["color-contrast"],
  "B9 agenda día": ["color-contrast"],
  "B10 agenda lista": ["color-contrast"],
  "C1 clientes": ["color-contrast"],
  "C2 ficha de la mascota": ["color-contrast"],
  "D1 servicios": ["aria-prohibited-attr", "color-contrast"],
  "D2 nuevo servicio": ["color-contrast"],
  "D3 equipo": ["color-contrast"],
  "D4 roles": ["color-contrast"],
  "E0 resumen del negocio": ["color-contrast"],
  "E1 perfil del negocio": ["color-contrast"],
  "E2 sedes": ["color-contrast"],
  "E3 reseñas": ["color-contrast"],
  "E4 suscripción": ["color-contrast"],
  "E5 notificaciones": ["aria-valid-attr-value", "color-contrast"],
  "E6 mi perfil": ["color-contrast"],
  "B4 detalle de cita": ["color-contrast"],
  "B5 nueva cita": ["color-contrast"],
  "C4 nuevo registro médico": ["color-contrast"],
  "A5 seleccionar negocio": ["color-contrast"],
  "X1 administración": ["color-contrast"],
};

const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function analizar(
  page: Page,
  pantalla: string,
  testInfo: TestInfo,
  { incluir }: { incluir?: string } = {},
) {
  // Sin esqueletos de carga a la vista (los datos ya llegaron).
  await expect(page.locator(".animate-pulse")).toHaveCount(0, { timeout: 15_000 });
  let builder = new AxeBuilder({ page }).withTags(ETIQUETAS);
  if (incluir) builder = builder.include(incluir);
  const resultado = await builder.analyze();
  await testInfo.attach(`axe-${pantalla}.json`, {
    body: JSON.stringify(resultado.violations, null, 2),
    contentType: "application/json",
  });
  const reglas = [...new Set(resultado.violations.map((v) => v.id))].sort();
  const resumen = resultado.violations.map(
    (v) =>
      `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  expect(reglas, `${pantalla}:\n${resumen.join("\n")}`).toEqual([...(CONOCIDAS[pantalla] ?? [])].sort());
}

async function sesion(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  return page;
}

test.describe("sin sesión", () => {
  for (const [pantalla, ruta] of [
    ["A1 login", "/login"],
    ["A2 recuperar contraseña", "/recuperar-password"],
    ["A7 crear cuenta", "/registro"],
  ] as const) {
    test(pantalla, async ({ page }, testInfo) => {
      await page.goto(ruta);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await analizar(page, pantalla, testInfo);
    });
  }
});

test.describe("panel del negocio (Salud Animal)", () => {
  let page: Page;
  let idNegocio: number;
  let idMascota: number;

  test.beforeAll(async ({ browser, request }) => {
    const ctx = await contextoSalud(request);
    idNegocio = ctx.idNegocio;
    const res = await request.get(`${API}/mascotas`, {
      headers: { Authorization: `Bearer ${await token(request, "camilo@petcat.test")}` },
    });
    idMascota = ((await res.json()) as { data: { id_mascota: number }[] }).data[0]!.id_mascota;
    page = await sesion(browser, PROPIETARIO_SALUD);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  const pantallas: [string, () => string][] = [
    ["B1 dashboard", () => `/n/${idNegocio}/dashboard`],
    ["B3 agenda semanal", () => `/n/${idNegocio}/agenda`],
    ["B9 agenda día", () => `/n/${idNegocio}/agenda?vista=dia`],
    ["B10 agenda lista", () => `/n/${idNegocio}/agenda?vista=lista`],
    ["C1 clientes", () => `/n/${idNegocio}/clientes`],
    ["C2 ficha de la mascota", () => `/n/${idNegocio}/clientes/mascotas/${idMascota}`],
    ["D1 servicios", () => `/n/${idNegocio}/servicios`],
    ["D2 nuevo servicio", () => `/n/${idNegocio}/servicios/nuevo`],
    ["D3 equipo", () => `/n/${idNegocio}/equipo/miembros`],
    ["D4 roles", () => `/n/${idNegocio}/equipo/roles`],
    ["E0 resumen del negocio", () => `/n/${idNegocio}/configuracion/resumen`],
    ["E1 perfil del negocio", () => `/n/${idNegocio}/configuracion/perfil`],
    ["E2 sedes", () => `/n/${idNegocio}/configuracion/sedes`],
    ["E3 reseñas", () => `/n/${idNegocio}/resenas`],
    ["E4 suscripción", () => `/n/${idNegocio}/suscripcion`],
    ["E5 notificaciones", () => `/n/${idNegocio}/notificaciones`],
    ["E6 mi perfil", () => `/n/${idNegocio}/mi-perfil`],
  ];
  for (const [pantalla, ruta] of pantallas) {
    test(pantalla, async ({}, testInfo) => {
      await page.goto(ruta());
      await expect(page.getByRole("main")).toBeVisible();
      await analizar(page, pantalla, testInfo);
    });
  }

  test("B4 detalle de cita", async ({ request }, testInfo) => {
    // La reserva es de esta prueba: si falla, el proceso se reinicia y un beforeAll la repetiría.
    const ctx = await contextoSalud(request);
    const cita = await reservaPendiente(request, ctx);
    try {
      await page.goto(`/n/${idNegocio}/agenda?cita=${cita.id_cita}&fecha=${cita.fecha}`);
      await expect(page.getByRole("dialog", { name: `Cita #${cita.id_cita}` })).toBeVisible();
      await analizar(page, "B4 detalle de cita", testInfo, { incluir: '[role="dialog"]' });
    } finally {
      await cancelarSiActiva(request, ctx, cita.id_cita);
    }
  });

  test("B5 nueva cita", async ({}, testInfo) => {
    await page.goto(`/n/${idNegocio}/agenda`);
    await page.getByRole("button", { name: "Nueva cita" }).click();
    await expect(page.getByRole("dialog", { name: "Nueva cita" })).toBeVisible();
    await analizar(page, "B5 nueva cita", testInfo, { incluir: '[role="dialog"]' });
  });

  test("C4 nuevo registro médico", async ({}, testInfo) => {
    await page.goto(`/n/${idNegocio}/clientes/mascotas/${idMascota}`);
    await page.getByRole("button", { name: "Registro médico" }).click();
    await expect(page.getByRole("dialog", { name: /^Nuevo registro médico/ })).toBeVisible();
    await analizar(page, "C4 nuevo registro médico", testInfo, { incluir: '[role="dialog"]' });
  });
});

test.describe("otros accesos", () => {
  test("A5 seleccionar negocio", async ({ browser }, testInfo) => {
    const page = await sesion(browser, "vet.salud@petcat.test");
    await expect(page).toHaveURL(/\/negocios$/);
    await analizar(page, "A5 seleccionar negocio", testInfo);
    await page.context().close();
  });

  test("X1 administración", async ({ browser }, testInfo) => {
    const page = await sesion(browser, "admin@petcat.test");
    await page.goto("/admin");
    await expect(page.getByRole("main")).toBeVisible();
    await analizar(page, "X1 administración", testInfo);
    await page.context().close();
  });
});
