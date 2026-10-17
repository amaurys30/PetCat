import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  cancelarSiActiva,
  contextoSalud,
  fechaBogota,
  PASSWORD,
  PROPIETARIO_SALUD,
  reservaPendiente,
} from "./citas";

/**
 * P4.4 · Agenda en tiempo real (Socket.IO) contra la API de demo, en Salud Animal: dos
 * navegadores con sesiones distintas del propietario; lo que cambia uno lo ve el otro sin
 * recargar, y una reserva desde la app aparece al momento con su aviso.
 */

/** Resuelve cuando Socket.IO confirma la conexión (paquete "40" por el WebSocket). */
const socketConectado = (page: Page) =>
  new Promise<void>((resolve) => {
    page.on("websocket", (ws) => {
      if (!ws.url().includes("/socket.io/")) return;
      ws.on("framereceived", ({ payload }) => {
        if (String(payload).startsWith("40")) resolve();
      });
    });
  });

/** Un navegador aparte con su propia sesión, abierto en la agenda de la fecha dada. */
async function agendaEnOtroNavegador(browser: Browser, idNegocio: number, fecha: string) {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  const conectado = socketConectado(page);
  await page.goto(`/n/${idNegocio}/agenda?fecha=${fecha}`);
  await conectado;
  return { contexto, page };
}

const porConfirmar = (page: Page, mascota: string, hora: string) =>
  page
    .getByRole("list", { name: "Citas por confirmar" })
    .getByRole("listitem")
    .filter({ hasText: mascota })
    .filter({ hasText: hora });

test("lo que confirma un navegador sale de Por confirmar en el otro sin recargar", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  const cita = await reservaPendiente(request, ctx);
  const a = await agendaEnOtroNavegador(browser, ctx.idNegocio, cita.fecha);
  const b = await agendaEnOtroNavegador(browser, ctx.idNegocio, cita.fecha);
  try {
    const enB = porConfirmar(b.page, cita.mascota.nombre, cita.hora_inicio);
    await expect(enB).toHaveCount(1);

    await porConfirmar(a.page, cita.mascota.nombre, cita.hora_inicio).getByRole("button", { name: "Confirmar" }).click();
    await expect(a.page.getByText(`Cita de ${cita.mascota.nombre} confirmada`)).toBeVisible();

    await expect(enB).toHaveCount(0, { timeout: 10_000 });
    // Quien confirmó no recibe el aviso de reserva; el otro tampoco (no es una reserva nueva).
    await expect(b.page.getByText("Nueva reserva desde la app")).toHaveCount(0);
    await expect(b.page.getByText("Sin actualización en tiempo real")).toHaveCount(0);
  } finally {
    await a.contexto.close();
    await b.contexto.close();
    await cancelarSiActiva(request, ctx, cita.id_cita);
  }
});

test("una reserva desde la app aparece al momento, con el aviso y Ver para abrirla", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  // La reserva cae desde mañana; el panel lateral "Por confirmar" no depende de la semana abierta.
  const panel = await agendaEnOtroNavegador(browser, ctx.idNegocio, fechaBogota(1));
  let idCita: number | null = null;
  try {
    const cita = await reservaPendiente(request, ctx);
    idCita = cita.id_cita;

    const avisoReserva = panel.page.getByRole("listitem").filter({ hasText: "Nueva reserva desde la app" });
    await expect(avisoReserva).toBeVisible({ timeout: 10_000 });
    await expect(avisoReserva).toContainText(cita.mascota.nombre);
    await expect(porConfirmar(panel.page, cita.mascota.nombre, cita.hora_inicio)).toHaveCount(1);

    await avisoReserva.getByRole("button", { name: "Ver" }).click();
    await expect(panel.page.getByRole("dialog", { name: `Cita #${cita.id_cita}` })).toBeVisible();
    await expect(panel.page).toHaveURL(new RegExp(`cita=${cita.id_cita}`));
  } finally {
    await panel.contexto.close();
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});
