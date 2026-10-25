import { expect, test, type Page } from "@playwright/test";

/**
 * P6.2 · Dashboard contra la API de demo, de solo lectura: Patitas (Gratuito, con citas
 * perdidas por no confirmar) y Salud Animal 24h (Pro en prueba, 90 días de citas).
 */
const PASSWORD = "Petcat123!";

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("Gratuito: secciones avanzadas bloqueadas y 12 meses como invitación a Pro", async ({ page }) => {
  await entrar(page, "propietario@petcat.test");
  await page.goto("/n/1/dashboard");

  const indicadores = page.getByRole("region", { name: "Indicadores del periodo" });
  await expect(indicadores.getByText("Ingresos registrados")).toBeVisible();
  await expect(indicadores.getByText(/vs periodo anterior/)).toHaveCount(0);
  await expect(page.getByText(/citas perdidas por no confirmar/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar confirmación automática" })).toBeVisible();
  // Seed: Rocky (de Camilo, cliente de Patitas) con el Moquillo vencido hace 12 días.
  await expect(page.getByText(/mascotas? con vacunas vencidas en los últimos 30 días/)).toBeVisible();

  const analisis = page.getByRole("region", { name: "Análisis del periodo" });
  await expect(analisis.getByText("Servicios más pedidos")).toBeVisible();
  await expect(analisis.getByText("Disponible en el plan Pro")).toHaveCount(3);

  await page.getByRole("combobox", { name: "Periodo" }).click();
  await page.getByRole("option", { name: /Últimos 12 meses/ }).click();
  await expect(page).toHaveURL(/periodo=12m/);
  await expect(
    page.getByRole("heading", { name: "Tu plan Gratuito permite ver hasta 92 días" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver los últimos 30 días" }).click();
  await expect(indicadores).toBeVisible();
  await expect(page).toHaveURL(/\/n\/1\/dashboard$/);
});

test("Pro: tendencia, comparación y desempeño por profesional", async ({ page }) => {
  await entrar(page, "saludanimal@petcat.test");
  await page.goto("/n/4/dashboard?periodo=90");

  const analisis = page.getByRole("region", { name: "Análisis del periodo" });
  await expect(analisis.getByRole("heading", { name: "Completadas por semana" })).toBeVisible();
  await expect(analisis.getByText("Valentina Ruiz")).toBeVisible();
  await expect(analisis.getByText("Ricardo Mendoza")).toBeVisible();
  await expect(analisis.getByRole("heading", { name: "Horas pico" })).toBeVisible();
  await expect(analisis.getByText("Disponible en el plan Pro")).toHaveCount(0);
  const indicadores = page.getByRole("region", { name: "Indicadores del periodo" });
  await expect(indicadores.getByText(/vs periodo anterior/).first()).toBeVisible();

  // Un año completo agrupa por mes.
  await page.getByRole("combobox", { name: "Periodo" }).click();
  await page.getByRole("option", { name: "Últimos 12 meses" }).click();
  await expect(analisis.getByRole("heading", { name: "Completadas por mes" })).toBeVisible();
});
