import { expect, test, type Page } from "@playwright/test";
import { API, contextoSalud, PASSWORD, PROPIETARIO_SALUD } from "./citas";
import { leerDeCorreo } from "./mailpit";

/**
 * P5.1 · Clientes (C1) contra la API de demo, en Salud Animal. Los clientes nuevos quedan en
 * la demo con teléfonos y correos únicos (se limpian recargándola); las notas se borran al final.
 */
const unico = () => `${Date.now()}`.slice(-7);
const ENLACE = /\/crear-password\/([0-9a-f]{64})/;

async function entrar(page: Page, ruta: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  await page.goto(ruta);
}

test("cliente sin cuenta: agregar correo, corregirlo (el enlace viejo deja de servir) y activar la cuenta", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  const id = unico();
  const telefono = `311${id}`;
  const errado = `jorje.e2e.${id}@petcat.test`;
  const correcto = `jorge.e2e.${id}@petcat.test`;

  await entrar(page, `/n/${ctx.idNegocio}/clientes`);
  await page.getByRole("button", { name: "Cliente" }).click();
  const c3 = page.getByRole("dialog", { name: "Registrar cliente sin app" });
  await c3.getByLabel("Nombre *").first().fill("Jorge");
  await c3.getByLabel("Apellido *").fill("Prueba e2e");
  await c3.getByLabel("Teléfono *").fill(telefono);
  await c3.getByLabel("Nombre *").nth(1).fill("Toby");
  await c3.getByRole("checkbox").check();
  await c3.getByRole("button", { name: "Registrar cliente" }).click();
  await expect(page.getByText("Jorge quedó registrado sin cuenta")).toBeVisible();

  // Queda elegido, sin cuenta y con la invitación a agregarle correo.
  await expect(page.getByRole("heading", { name: "Jorge Prueba e2e" })).toBeVisible();
  await expect(page.getByText(/Cliente sin cuenta\./)).toBeVisible();
  await page.getByRole("button", { name: "Agregar correo" }).click();
  const agregar = page.getByRole("dialog", { name: "Agregar correo" });
  await agregar.getByLabel("Correo").fill(errado);
  await agregar.getByRole("button", { name: "Agregar y enviar bienvenida" }).click();
  await expect(
    page.getByText("Correo agregado. Le enviamos la bienvenida para que active su cuenta"),
  ).toBeVisible();
  const enlaceViejo = await leerDeCorreo(request, errado, ENLACE);

  // El correo estaba mal escrito: se corrige y el enlace que fue a la dirección errada ya no sirve.
  await expect(page.getByText(/Aún no activa su cuenta/)).toBeVisible();
  await page.getByRole("button", { name: "Corregir correo" }).click();
  const corregir = page.getByRole("dialog", { name: "Corregir correo" });
  await corregir.getByLabel("Correo").fill(correcto);
  await corregir.getByRole("button", { name: "Corregir y enviar" }).click();
  await expect(page.getByText(/Correo corregido/)).toBeVisible();
  const enlaceNuevo = await leerDeCorreo(request, correcto, ENLACE);
  expect(enlaceNuevo).not.toBe(enlaceViejo);

  const viejo = await request.post(`${API}/auth/reset-password`, {
    data: { token: enlaceViejo, password: "Clave2026x" },
  });
  expect(viejo.status()).toBe(400);

  // Con el enlace nuevo crea su contraseña en el panel: la cuenta queda activa.
  const cliente = await page.context().browser()!.newContext();
  const pagina = await cliente.newPage();
  await pagina.goto(`/crear-password/${enlaceNuevo}`);
  await pagina.getByLabel("Nueva contraseña").fill("Clave2026x");
  await pagina.getByLabel("Confirmar contraseña").fill("Clave2026x");
  await pagina.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(pagina.getByText("Listo, tu cuenta quedó activa. Ya puedes iniciar sesión.")).toBeVisible();
  await cliente.close();
  await expect
    .poll(async () =>
      (
        await request.post(`${API}/auth/login`, { data: { email: correcto, password: "Clave2026x" } })
      ).status(),
    )
    .toBe(200);

  // Activada la cuenta, el panel ya no ofrece cambiar el correo.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Jorge Prueba e2e" })).toBeVisible();
  await expect(page.getByText("Usa la app")).toBeVisible();
  await expect(page.getByRole("button", { name: "Corregir correo" })).toHaveCount(0);
});

test("notas privadas: escribir, editar y borrar; la búsqueda del Topbar abre al cliente", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const texto = `Nota e2e ${unico()}`;

  await entrar(page, `/n/${ctx.idNegocio}/agenda`);
  await page.getByRole("combobox", { name: "Buscar cliente o mascota" }).fill("Camilo");
  await page
    .getByRole("list", { name: "Resultados de la búsqueda" })
    .getByRole("button", { name: /Camilo Torres/ })
    .click();
  await expect(page).toHaveURL(/\/clientes\?cliente=\d+/);
  await expect(page.getByRole("heading", { name: "Camilo Torres" })).toBeVisible();

  const notas = page.getByRole("region", { name: "Notas del negocio" });
  await notas.getByLabel("Nueva nota").fill(texto);
  await notas.getByRole("button", { name: "Guardar nota" }).click();
  const nota = notas.getByRole("listitem").filter({ hasText: texto });
  await expect(nota).toBeVisible();

  await nota.getByRole("button", { name: "Editar nota" }).click();
  await notas.getByLabel("Editar nota").fill(`${texto} editada`);
  await notas.getByRole("button", { name: "Guardar", exact: true }).click();
  const editada = notas.getByRole("listitem").filter({ hasText: `${texto} editada` });
  await expect(editada.getByText(/· editada/)).toBeVisible();

  await editada.getByRole("button", { name: "Borrar nota" }).click();
  await page.getByRole("button", { name: "Borrar nota" }).last().click();
  await expect(page.getByText("Nota eliminada")).toBeVisible();
  await expect(notas.getByText(texto)).toHaveCount(0);
});
