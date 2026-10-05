import { expect, test, type Page } from "@playwright/test";

/**
 * P4.1 · Agenda contra la API de demo, en Clínica Veterinaria Patitas (propietario@petcat.test).
 * El seed tiene una semana de citas alrededor del día en que se carga, con Carlos y Paula, dos
 * reservas por confirmar y una cita de Paula que cae en su bloqueo "Cita médica personal".
 * Las pendientes se cancelan solas al vencer su plazo: si la demo es de otro día, recárgala.
 */
const PASSWORD = "Petcat123!";

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("propietario@petcat.test");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/1\//);
}

test("semana con el panel lateral; la cita fuera de disponibilidad lleva a su día con el bloqueo de Paula", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await entrar(page);
  await page
    .getByRole("navigation", { name: "Secciones del negocio" })
    .getByRole("link", { name: /Agenda/ })
    .click();
  await expect(page).toHaveURL(/\/n\/1\/agenda$/);

  await expect(page.getByText(/^Sede Centro · \d+ citas? esta semana$/)).toBeVisible();
  await expect(page.getByTestId("calendario").getByRole("button").first()).toBeVisible();
  await expect(page.getByText(/^Por confirmar \(\d+\)$/)).toBeVisible();

  const fuera = page.getByRole("list", { name: "Citas fuera de disponibilidad" });
  const tarjeta = fuera.getByRole("button", { name: /Milo/ });
  await expect(tarjeta).toContainText("Paula tiene un bloqueo: Cita médica personal.");
  await tarjeta.click();
  await expect(page).toHaveURL(/cita=\d+/);

  await page.getByRole("radio", { name: "Día" }).click();
  const paula = page.getByRole("group", { name: "Paula Rojas" });
  await expect(paula.getByText("Bloqueo 14:00–18:00 · Cita médica personal")).toBeVisible();
  await expect(paula.getByRole("button", { name: /15:30–16:00 · Milo/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("group", { name: "Carlos Pérez" })).toBeVisible();
});

test("la lista filtrada por profesional solo trae sus citas y el filtro queda en la URL", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await entrar(page);
  await page.goto("/n/1/agenda?vista=lista");
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();

  await page.getByRole("combobox", { name: "Profesional" }).click();
  await page.getByRole("option", { name: "Paula Rojas" }).click();
  await expect(page).toHaveURL(/profesional=\d+/);

  const filas = page.getByRole("region").getByRole("button");
  await expect(filas.first()).toBeVisible();
  for (const fila of await filas.all()) await expect(fila).toHaveAccessibleName(/Paula Rojas/);

  // Con la URL se vuelve a la misma vista.
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Profesional" })).toHaveText("Paula Rojas");
});
