import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  API,
  cancelarSiActiva,
  contextoSalud,
  estadoDe,
  fechaBogota,
  PASSWORD,
  PROPIETARIO_SALUD,
  reservaPendiente,
  token,
} from "./citas";
import { leerDeCorreo } from "./mailpit";

/**
 * P7 · Recorridos completos contra la API de demo, en Centro Veterinario Salud Animal 24h:
 * de punta a punta y sin atajos por la URL donde el usuario no los usaría. Cada prueba crea
 * sus datos y cancela al final las citas que dejó activas.
 */
const VETERINARIA = "vet.salud@petcat.test";
const unico = () => `${Date.now()}`.slice(-7);

async function entrar(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

const conToken = (tk: string) => ({ headers: { Authorization: `Bearer ${tk}` } });

async function getApi<T>(request: APIRequestContext, url: string, tk: string) {
  const res = await request.get(`${API}${url}`, conToken(tk));
  expect(res.ok(), `${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

test("recorrido: entrar → negocio → confirmar una reserva → agendar → atender → completar → registro médico", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  const ctx = await contextoSalud(request);
  const reserva = await reservaPendiente(request, ctx);
  const diagnostico = `Recorrido e2e ${unico()}`;
  let idCita: number | null = null;
  try {
    // Entrar: la propietaria de un solo negocio llega directo a su panel.
    await entrar(page, PROPIETARIO_SALUD);
    await expect(page).toHaveURL(new RegExp(`/n/${ctx.idNegocio}/`));
    await page
      .getByRole("navigation", { name: "Secciones del negocio" })
      .getByRole("link", { name: "Agenda" })
      .click();

    // Confirmar la reserva de la app desde "Por confirmar".
    const tarjeta = page
      .getByRole("list", { name: "Citas por confirmar" })
      .getByRole("listitem")
      .filter({ hasText: reserva.mascota.nombre })
      .filter({ hasText: reserva.hora_inicio });
    await tarjeta.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(`Cita de ${reserva.mascota.nombre} confirmada`)).toBeVisible();
    expect(await estadoDe(request, ctx, reserva.id_cita)).toBe("confirmada");

    // Agendar para hoy desde el panel, para Camilo, buscado por teléfono.
    await page.getByRole("button", { name: "Nueva cita" }).click();
    const d = page.getByRole("dialog", { name: "Nueva cita" });
    await d.getByLabel("Buscar cliente").fill("300 666 0101");
    await d.getByRole("button", { name: "Buscar" }).click();
    await d
      .getByRole("list", { name: "Clientes encontrados" })
      .getByRole("button", { name: /Camilo Torres/ })
      .click();
    await d.getByRole("radiogroup", { name: "Mascota" }).getByRole("radio").first().click();
    await d.getByRole("combobox", { name: "Servicio" }).click();
    await page.getByRole("option", { name: /^Desparasitación/ }).click();
    const sede = d.getByRole("combobox", { name: "Sede" });
    if (await sede.isVisible()) {
      await sede.click();
      await page.getByRole("option", { name: "Sede Norte" }).click();
    }
    await d.getByRole("radiogroup", { name: "Fecha" }).getByRole("radio").first().click();
    const horarios = d.getByRole("radiogroup", { name: "Horarios libres" }).getByRole("radio");
    await expect(horarios.first().or(d.getByText(/No hay horarios/))).toBeVisible();
    test.skip((await horarios.count()) === 0, "Ya no quedan horarios hoy en la Sede Norte");
    await horarios.first().click();
    await d.getByRole("button", { name: "Agendar cita (queda confirmada)" }).click();
    await expect(page.getByText(/^Cita agendada y confirmada:/)).toBeVisible();
    await expect(page).toHaveURL(/cita=\d+/);
    idCita = Number(new URL(page.url()).searchParams.get("cita"));

    // Atender y completar con el registro médico.
    const detalle = page.getByRole("dialog", { name: `Cita #${idCita}` });
    await detalle.getByRole("button", { name: "Iniciar atención" }).click();
    await expect(page.getByText("Cita en curso")).toBeVisible();
    await detalle.getByRole("button", { name: "Completar" }).click();
    const completar = page.getByRole("dialog", { name: "Completar cita" });
    await completar.getByRole("checkbox", { name: /Crear el registro médico al terminar/ }).check();
    await completar.getByRole("button", { name: "Completar cita" }).click();
    await expect(page.getByText("Cita completada")).toBeVisible();

    const c4 = page.getByRole("dialog", { name: /^Nuevo registro médico · / });
    await expect(c4.getByRole("combobox", { name: "Vincular a una cita" })).toContainText("Desparasitación");
    await c4.getByLabel("Diagnóstico").fill(diagnostico);
    await c4.getByLabel("Peso (kg)").fill("12,5");
    await c4.getByRole("button", { name: "Guardar registro" }).click();
    await expect(page.getByText("Registro médico guardado")).toBeVisible();
    expect(await estadoDe(request, ctx, idCita)).toBe("completada");

    // El registro queda en la cita y en la ficha de la mascota.
    await expect(detalle.getByText(/^Registro médico: /)).toBeVisible();
    await detalle.getByRole("link", { name: "Ver ficha médica →" }).click();
    await expect(page.getByRole("article").filter({ hasText: diagnostico })).toBeVisible();
  } finally {
    await cancelarSiActiva(request, ctx, reserva.id_cita);
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});

test("invitar a un miembro: el correo llega, crea su cuenta y entra con su rol", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const ctx = await contextoSalud(request);
  const email = `flujo.${unico()}@petcat.test`;

  await entrar(page, PROPIETARIO_SALUD);
  await page.goto(`/n/${ctx.idNegocio}/equipo/miembros`);
  await page.getByRole("button", { name: "Agregar miembro" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nombre *").fill("Marina");
  await dialogo.getByLabel("Apellido *").fill("Flujo");
  await dialogo.getByLabel("Correo (para la invitación)").fill(email);
  await dialogo.getByRole("radio", { name: /Recepcionista/ }).click();
  await dialogo.getByRole("button", { name: "Guardar y enviar invitación" }).click();
  await expect(
    page.getByText(`Marina Flujo quedó en el equipo. Invitación enviada a ${email}.`),
  ).toBeVisible();

  // La invitada abre el enlace en otro navegador, sin sesión.
  const enlace = await leerDeCorreo(request, email, /\/invitacion\/([0-9a-f]{64})/);
  const otro = await browser.newContext();
  try {
    const invitada = await otro.newPage();
    await invitada.goto(`/invitacion/${enlace}`);
    await expect(
      invitada.getByRole("heading", { name: "Centro Veterinario Salud Animal 24h" }),
    ).toBeVisible();
    await invitada.getByLabel("Contraseña", { exact: true }).fill("Marina1234");
    await invitada.getByLabel(/Acepto la política/).check();
    await invitada.getByRole("button", { name: "Aceptar y entrar" }).click();
    await expect(invitada).toHaveURL(new RegExp(`/n/${ctx.idNegocio}/`));

    // Recepcionista: ve la agenda de todos, pero no la configuración.
    const menu = invitada.getByRole("navigation", { name: "Secciones del negocio" });
    await expect(menu.getByRole("link", { name: "Agenda" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Configuración" })).toHaveCount(0);
    await menu.getByRole("link", { name: "Agenda" }).click();
    await expect(invitada.getByRole("combobox", { name: "Profesional" })).toBeVisible();
  } finally {
    await otro.close();
  }

  // En Equipo ya aparece activa, sin invitación pendiente.
  await page.reload();
  await page.getByLabel("Buscar miembro").fill(email);
  const fila = page.getByRole("row").filter({ hasText: email });
  await expect(fila).toBeVisible();
  await expect(fila.getByText(/Invitación pendiente/)).toHaveCount(0);
});

test("cliente sin app: registrarlo con su mascota, agendarle y encontrarlo en Clientes", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  const telefono = `311${unico()}`;
  const mascota = `Nube${unico().slice(-3)}`;
  let idCita: number | null = null;
  try {
    await entrar(page, PROPIETARIO_SALUD);
    await page.goto(`/n/${ctx.idNegocio}/agenda`);
    await page.getByRole("button", { name: "Nueva cita" }).click();
    const d = page.getByRole("dialog", { name: "Nueva cita" });
    await d.getByLabel("Buscar cliente").fill(telefono);
    await d.getByRole("button", { name: "Buscar" }).click();
    await d.getByRole("button", { name: "Registrar cliente sin app" }).click();

    const c3 = page.getByRole("dialog", { name: "Registrar cliente sin app" });
    await c3.getByLabel("Nombre *").first().fill("Rosa");
    await c3.getByLabel("Apellido *").fill("Flujo");
    await c3.getByLabel("Nombre *").nth(1).fill(mascota);
    await c3.getByRole("radiogroup", { name: "Especie *" }).getByRole("radio", { name: "Gato" }).click();
    await c3.getByRole("radiogroup", { name: "Sexo" }).getByRole("radio", { name: "Hembra" }).click();
    await c3.getByRole("checkbox").check();
    await c3.getByRole("button", { name: "Registrar y agendar cita" }).click();
    await expect(page.getByText(/Rosa quedó registrado sin cuenta/)).toBeVisible();

    await d.getByRole("combobox", { name: "Servicio" }).click();
    await page.getByRole("option", { name: /^Consulta especializada/ }).click();
    const sede = d.getByRole("combobox", { name: "Sede" });
    if (await sede.isVisible()) {
      await sede.click();
      await page.getByRole("option", { name: "Sede Norte" }).click();
    }
    await d.getByRole("radiogroup", { name: "Fecha" }).getByRole("radio").nth(1).click();
    await d.getByRole("radiogroup", { name: "Horarios libres" }).getByRole("radio").first().click();
    await d.getByRole("button", { name: "Agendar cita (queda confirmada)" }).click();
    await expect(page.getByText(/^Cita agendada y confirmada:/)).toBeVisible();
    await expect(page).toHaveURL(/cita=\d+/);
    idCita = Number(new URL(page.url()).searchParams.get("cita"));

    // En Clientes: sin app, con su mascota; la ficha la muestra como gata hembra.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: `Cita #${idCita}` })).toBeHidden();
    await page
      .getByRole("navigation", { name: "Secciones del negocio" })
      .getByRole("link", { name: "Clientes" })
      .click();
    await page.getByLabel("Buscar clientes").fill(telefono);
    await page
      .getByRole("list", { name: "Clientes" })
      .getByRole("button", { name: new RegExp(`Rosa Flujo ${telefono}`) })
      .click();
    const mascotas = page.getByRole("region", { name: "Mascotas" });
    await expect(mascotas.getByText(mascota)).toBeVisible();
    await mascotas.getByRole("link", { name: `Ficha de ${mascota}` }).click();
    await expect(page.getByRole("heading", { name: new RegExp(mascota) })).toBeVisible();
    await expect(page.getByText(/Gato · .*Hembra/)).toBeVisible();
  } finally {
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});

test("veterinaria con permisos limitados: solo su agenda y el registro a su nombre", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  const ctx = await contextoSalud(request);
  const tkVet = await token(request, VETERINARIA);
  const mios = await getApi<{ id_negocio: number; id_empleado: number | null }[]>(
    request,
    "/negocios/mios",
    tkVet,
  );
  const idVet = mios.find((n) => n.id_negocio === ctx.idNegocio)!.id_empleado!;

  // Una cita de la veterinaria y otra de otro profesional, el mismo día, creadas por el propietario.
  const tkCamilo = await token(request, "camilo@petcat.test");
  const camilo = await getApi<{ id_usuario: number }>(request, "/auth/me", tkCamilo);
  const [rocky] = await getApi<{ id_mascota: number; nombre: string; fallecido: boolean }[]>(
    request,
    "/mascotas",
    tkCamilo,
  ).then((m) => m.filter((x) => !x.fallecido));
  const creadas: number[] = [];
  const agendar = async (fecha: string, conVet: boolean) => {
    const libres = await getApi<{
      horarios: { hora_inicio: string; empleados: { id_empleado: number }[] }[];
    }>(
      request,
      `/negocios/${ctx.idNegocio}/citas/horarios-libres?id_servicio=${ctx.idServicio}&id_sucursal=${ctx.idSucursal}&fecha=${fecha}`,
      ctx.tkNegocio,
    );
    for (const h of [...libres.horarios].reverse()) {
      const empleado = h.empleados.find((e) => (conVet ? e.id_empleado === idVet : e.id_empleado !== idVet));
      if (!empleado) continue;
      const res = await request.post(`${API}/negocios/${ctx.idNegocio}/citas`, {
        ...conToken(ctx.tkNegocio),
        data: {
          id_usuario: camilo.id_usuario,
          id_mascota: rocky!.id_mascota,
          id_servicio: ctx.idServicio,
          id_sucursal: ctx.idSucursal,
          fecha,
          hora_inicio: h.hora_inicio,
          id_empleado: empleado.id_empleado,
          origen: "telefono",
        },
      });
      if (res.status() === 201) {
        const cita = ((await res.json()) as { data: { id_cita: number } }).data;
        creadas.push(cita.id_cita);
        return cita.id_cita;
      }
    }
    return null;
  };
  let fecha = "";
  let propia: number | null = null;
  let ajena: number | null = null;
  for (let dia = 1; dia <= 14 && (!propia || !ajena); dia++) {
    for (const id of creadas.splice(0)) await cancelarSiActiva(request, ctx, id);
    fecha = fechaBogota(dia);
    propia = await agendar(fecha, true);
    ajena = propia ? await agendar(fecha, false) : null;
  }
  test.skip(!propia || !ajena, "No hubo un día con horarios de la veterinaria y de otro profesional");

  try {
    // Dos negocios: elige Salud Animal en el selector.
    await entrar(page, VETERINARIA);
    await expect(page).toHaveURL(/\/negocios$/);
    await page.getByRole("link", { name: /Centro Veterinario Salud Animal/ }).click();
    await expect(page).toHaveURL(new RegExp(`/n/${ctx.idNegocio}/`));

    // La agenda del día: solo su columna y su cita, sin filtro de profesional.
    await page.goto(`/n/${ctx.idNegocio}/agenda?vista=dia&fecha=${fecha}`);
    await expect(page.getByText("Solo tus citas")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Profesional" })).toHaveCount(0);
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("radio", { name: "Lista" }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(`#${propia}\\b|${rocky!.nombre}`) }).first(),
    ).toBeVisible();

    // La cita de otro profesional no se abre (403 de la API).
    const detalleAjeno = await request.get(`${API}/citas/${ajena}`, conToken(tkVet));
    expect(detalleAjeno.status()).toBe(403);
    await page.goto(`/n/${ctx.idNegocio}/agenda?cita=${ajena}&fecha=${fecha}`);
    await expect(page.getByText(/otro profesional|No tienes permiso/).first()).toBeVisible();

    // Registro médico desde la ficha: el profesional queda fijo a su nombre.
    await page.goto(`/n/${ctx.idNegocio}/clientes/mascotas/${rocky!.id_mascota}`);
    await page.getByRole("button", { name: "Registro médico" }).click();
    const c4 = page.getByRole("dialog", { name: /^Nuevo registro médico · / });
    const profesional = c4.getByRole("combobox", { name: "Profesional" });
    await expect(profesional).toBeDisabled();
    await expect(c4.getByText(/Queda a tu nombre/)).toBeVisible();
  } finally {
    for (const id of creadas) await cancelarSiActiva(request, ctx, id);
  }
});
