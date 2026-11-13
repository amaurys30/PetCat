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
  "A1 login": [],
  "A2 recuperar contraseña": [],
  "A7 crear cuenta": [],
  "B1 dashboard": ["aria-hidden-focus"],
  "B3 agenda semanal": [],
  "B9 agenda día": [],
  "B10 agenda lista": [],
  "C1 clientes": [],
  "C2 ficha de la mascota": [],
  "D1 servicios": ["aria-prohibited-attr"],
  "D2 nuevo servicio": [],
  "D3 equipo": [],
  "D4 roles": [],
  "E0 resumen del negocio": [],
  "E1 perfil del negocio": [],
  "E2 sedes": [],
  "E3 reseñas": [],
  "E4 suscripción": [],
  "E5 notificaciones": ["aria-valid-attr-value"],
  "E6 mi perfil": [],
  "B4 detalle de cita": [],
  "B5 nueva cita": [],
  "C4 nuevo registro médico": [],
  "A5 seleccionar negocio": [],
  "X1 administración": [],
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

test.describe("páginas públicas", () => {
  // Con "reducir movimiento" las secciones se ven desde el inicio: sin la animación de entrada,
  // axe analiza toda la página (con opacidad 0 la saltaría o mediría un contraste a medias).
  test.use({ reducedMotion: "reduce" });

  for (const [pantalla, ruta, ancho] of [
    ["landing", "/", 1440],
    ["landing en celular", "/", 360],
    ["para negocios", "/para-negocios", 1440],
    ["para negocios en celular", "/para-negocios", 360],
  ] as const) {
    test(pantalla, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/Versión \d/)).toBeVisible();
      await analizar(page, pantalla, testInfo);
    });
  }

  test("menú del celular abierto", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(page.getByRole("navigation", { name: "Menú" })).toBeVisible();
    await analizar(page, "menú del celular abierto", testInfo);
  });
});

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
    // eslint-disable-next-line no-empty-pattern -- Playwright exige desestructurar el primer argumento
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

  // eslint-disable-next-line no-empty-pattern -- Playwright exige desestructurar el primer argumento
  test("B5 nueva cita", async ({}, testInfo) => {
    await page.goto(`/n/${idNegocio}/agenda`);
    await page.getByRole("button", { name: "Nueva cita" }).click();
    await expect(page.getByRole("dialog", { name: "Nueva cita" })).toBeVisible();
    await analizar(page, "B5 nueva cita", testInfo, { incluir: '[role="dialog"]' });
  });

  // eslint-disable-next-line no-empty-pattern -- Playwright exige desestructurar el primer argumento
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
