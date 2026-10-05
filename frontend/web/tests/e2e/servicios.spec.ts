import { expect, test, type Page } from "@playwright/test";

/**
 * P3 · Servicios contra la API de demo, en Clínica Veterinaria Patitas (propietario@petcat.test).
 * Cada corrida crea servicios con nombres únicos y los deja en petcat_demo (se limpian
 * recargando la demo). "Consulta general" tiene citas futuras en el seed.
 */
const PASSWORD = "Petcat123!";
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("propietario@petcat.test");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/1\//);
}

const tarjeta = (page: Page, nombre: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name: nombre, exact: true }) });

async function crearServicio(page: Page, nombre: string, { profesional }: { profesional?: string } = {}) {
  await page.goto("/n/1/servicios/nuevo");
  await page.getByLabel("Nombre *").fill(nombre);
  await page.getByRole("combobox", { name: "Categoría *" }).click();
  await page.getByRole("option", { name: "Vacunación" }).click();
  await page.getByLabel("Precio base (COP) *").fill("35000");
  if (profesional) await page.getByRole("checkbox", { name: new RegExp(profesional) }).check();
  await page.getByRole("button", { name: "Guardar servicio" }).click();
  if (!profesional) await page.getByRole("button", { name: "Guardar igual" }).click();
  await expect(page).toHaveURL(/\/n\/1\/servicios$/);
}

test("crea un servicio con oferta, especies, profesional e indicaciones; Equipo ve la asignación y la cambia", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const nombre = `Vacuna e2e ${unico()}`;
  await entrar(page);
  await page.goto("/n/1/servicios/nuevo");

  await page.getByLabel("Nombre *").fill(nombre);
  await page.getByRole("combobox", { name: "Categoría *" }).click();
  await page.getByRole("option", { name: "Vacunación" }).click();

  // "Todas" no se combina: al elegir Perro y Gato se desmarca.
  const especies = page.getByRole("group", { name: "Especies que atiende *" });
  await especies.getByRole("button", { name: "Perro" }).click();
  await especies.getByRole("button", { name: "Gato" }).click();
  await expect(especies.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");

  await page.getByLabel("Precio base (COP) *").fill("45000");
  await expect(page.getByLabel("Precio base (COP) *")).toHaveValue("45.000");
  await page.getByLabel("Precio máximo").fill("40000");
  await page.getByLabel("Duración (min) *").fill("32");

  // Oferta: la fecha de inicio llega con hoy; el fin es obligatorio.
  await page.getByRole("switch", { name: "En oferta" }).click();
  await expect(page.getByLabel("Desde *")).not.toHaveValue("");
  await page.getByLabel("Precio de oferta *").fill("50000");

  await page.getByRole("button", { name: "Guardar servicio" }).click();
  await expect(page.getByText("Debe ser mayor o igual que el precio base")).toBeVisible();
  await expect(page.getByText("Debe ser múltiplo de 5")).toBeVisible();
  await expect(page.getByText("Debe ser menor que el precio base")).toBeVisible();
  await expect(page.getByText("Obligatoria si el servicio está en oferta")).toBeVisible();

  await page.getByLabel("Precio máximo").fill("");
  await page.getByLabel("Duración (min) *").fill("30");
  await page.getByLabel("Precio de oferta *").fill("38000");
  const fin = new Date();
  fin.setDate(fin.getDate() + 7);
  await page.getByLabel("Hasta *").fill(fin.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));

  // Indicaciones: sin saltos de línea y con la vista previa del recordatorio.
  await page.getByLabel("Indicaciones previas").fill("Ayuno de 8 horas\nTrae el carnet de vacunas");
  await expect(page.getByLabel("Indicaciones previas")).toHaveValue(
    "Ayuno de 8 horas Trae el carnet de vacunas",
  );
  await expect(page.getByTestId("vista-previa-indicaciones")).toContainText(
    `Max tiene ${nombre} en Clínica Veterinaria Patitas. Indicaciones del negocio: Ayuno de 8 horas Trae el carnet de vacunas.`,
  );

  await page.getByRole("checkbox", { name: /Carlos Pérez/ }).check();
  await page.getByRole("button", { name: "Guardar servicio" }).click();

  await expect(page).toHaveURL(/\/n\/1\/servicios$/);
  const card = tarjeta(page, nombre);
  await expect(card.getByText("En oferta")).toBeVisible();
  await expect(card.getByText("Perros y gatos")).toBeVisible();
  await expect(card.getByText("Reservable")).toBeVisible();

  // Equipo muestra el servicio en lo que atiende Carlos y lo quita desde su formulario.
  await page.goto("/n/1/equipo/miembros");
  const fila = page.getByRole("row").filter({ hasText: "Carlos Pérez" });
  await expect(fila).toContainText(nombre);
  await page.getByRole("button", { name: "Más acciones para Carlos Pérez" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: nombre }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // El catálogo ya lo muestra sin profesionales, con el aviso para asignar.
  await page.goto("/n/1/servicios");
  await expect(tarjeta(page, nombre).getByText("Sin profesionales")).toBeVisible();
  await expect(tarjeta(page, nombre).getByText("No reservable")).toBeVisible();
  await tarjeta(page, nombre).getByRole("link", { name: nombre }).click();
  await expect(page.getByRole("checkbox", { name: /Carlos Pérez/ })).not.toBeChecked();
});

test("desactivar un servicio con citas futuras muestra las citas; sin citas se desactiva", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await entrar(page);
  await page.goto("/n/1/servicios");

  await page.getByRole("button", { name: "Acciones de Consulta general" }).click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await page.getByRole("button", { name: "Desactivar" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText("«Consulta general» no se puede desactivar");
  await expect(dialogo.getByRole("table")).toBeVisible();
  await dialogo.getByRole("button", { name: "Entendido" }).click();
  await expect(tarjeta(page, "Consulta general").getByText("Activo", { exact: true })).toBeVisible();

  const nombre = `Sin citas e2e ${unico()}`;
  await crearServicio(page, nombre);
  await page.getByRole("button", { name: `Acciones de ${nombre}` }).click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await page.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText(`«${nombre}» quedó inactivo`)).toBeVisible();
  await expect(tarjeta(page, nombre)).toHaveCount(0);
});

test("reactivar con el nombre ocupado lleva a cambiarle el nombre y después se reactiva", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const nombre = `Repetido e2e ${unico()}`;
  await entrar(page);

  await crearServicio(page, nombre, { profesional: "Carlos Pérez" });
  await page.getByRole("button", { name: `Acciones de ${nombre}` }).click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await page.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText(`«${nombre}» quedó inactivo`)).toBeVisible();
  await crearServicio(page, nombre, { profesional: "Carlos Pérez" });

  await page.getByRole("combobox", { name: "Estado" }).click();
  await page.getByRole("option", { name: "Inactivos" }).click();
  await page.getByRole("button", { name: `Acciones de ${nombre}` }).click();
  await page.getByRole("menuitem", { name: "Reactivar" }).click();
  await expect(page.getByText(`Ya hay otro servicio activo llamado «${nombre}»`)).toBeVisible();
  await page.getByRole("button", { name: "Cambiar nombre" }).click();

  await expect(page.getByText("Cámbiale el nombre, guarda y después reactívalo.")).toBeVisible();
  await expect(page.getByLabel("Nombre *")).toBeFocused();
  await page.getByLabel("Nombre *").fill(`${nombre} (2)`);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await page.getByRole("button", { name: "Reactivar" }).click();
  await expect(page.getByText(`«${nombre} (2)» está activo de nuevo`)).toBeVisible();

  await page.goto("/n/1/servicios");
  await expect(tarjeta(page, `${nombre} (2)`).getByText("Reservable")).toBeVisible();
});
