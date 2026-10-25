// El aviso del navegador se simula dentro de la página: hacen falta los tipos del DOM.
/// <reference lib="dom" />
import { expect, test, type Browser, type Page } from "@playwright/test";
import { cancelarSiActiva, contextoSalud, PASSWORD, PROPIETARIO_SALUD, reservaPendiente } from "./citas";

/**
 * P6.4 · Notificaciones contra la API de demo, en Salud Animal: una reserva desde la app (Camilo,
 * por la API) llega a la campana en tiempo real, la notificación abre la cita y, con la pestaña
 * oculta y los avisos activos, sale el aviso del sistema operativo. Cada prueba cancela su cita.
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

async function entrar(browser: Browser, idNegocio: number, { pestanaOculta = false } = {}) {
  const contexto = await browser.newContext();
  if (pestanaOculta) {
    // La Notification API real no se puede inspeccionar: se reemplaza por una que guarda los avisos,
    // con los avisos activados y la pestaña oculta.
    await contexto.addInitScript(() => {
      const avisos: { titulo: string; cuerpo?: string; tag?: string; abrir: () => void }[] = [];
      (window as unknown as { __avisos: typeof avisos }).__avisos = avisos;
      class NotificacionFalsa {
        static permission = "granted";
        static requestPermission = async () => "granted";
        onclick: (() => void) | null = null;
        constructor(titulo: string, opciones: NotificationOptions) {
          avisos.push({ titulo, cuerpo: opciones.body, tag: opciones.tag, abrir: () => this.onclick?.() });
        }
        close() {}
      }
      Object.defineProperty(window, "Notification", { value: NotificacionFalsa });
      Object.defineProperty(document, "visibilityState", { get: () => "hidden" });
      localStorage.setItem("petcat.avisosNavegador", "1");
    });
  }
  const page = await contexto.newPage();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(PROPIETARIO_SALUD);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/n\/\d+\//);
  const conectado = socketConectado(page);
  await page.goto(`/n/${idNegocio}/mi-perfil`);
  await conectado;
  return { contexto, page };
}

const contador = async (page: Page) => {
  const nombre =
    (await page.getByRole("button", { name: /^Notificaciones/ }).getAttribute("aria-label")) ?? "";
  return Number(/(\d+) sin leer/.exec(nombre)?.[1] ?? 0);
};

test("una reserva desde la app llega a la campana al momento y abre la cita", async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  const { contexto, page } = await entrar(browser, ctx.idNegocio);
  let idCita: number | undefined;
  try {
    const antes = await contador(page);
    const cita = await reservaPendiente(request, ctx);
    idCita = cita.id_cita;

    await expect(page.getByRole("button", { name: `Notificaciones: ${antes + 1} sin leer` })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveTitle(`(${antes + 1}) PetCat · Panel`);

    await page.getByRole("button", { name: /^Notificaciones/ }).click();
    const panel = page.getByRole("dialog", { name: "Notificaciones" });
    await panel
      .getByRole("button", { name: /Nueva cita por confirmar/ })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/n/${ctx.idNegocio}/agenda\\?fecha=${cita.fecha}&cita=${cita.id_cita}$`),
    );
    await expect(page.getByRole("dialog", { name: `Cita #${cita.id_cita}` })).toBeVisible();
    await expect(page).toHaveTitle(antes > 0 ? `(${antes}) PetCat · Panel` : "PetCat · Panel");

    await page.keyboard.press("Escape");
    if (antes > 0) {
      await page.getByRole("button", { name: /^Notificaciones/ }).click();
      await page
        .getByRole("dialog", { name: "Notificaciones" })
        .getByRole("button", { name: "Marcar todas como leídas" })
        .click();
    }
    await expect(page.getByRole("button", { name: "Notificaciones" })).toBeVisible();
    await expect(page).toHaveTitle("PetCat · Panel");
  } finally {
    await contexto.close();
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});

test("con la pestaña oculta y los avisos activos, el aviso del sistema es genérico y abre la cita", async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const ctx = await contextoSalud(request);
  const { contexto, page } = await entrar(browser, ctx.idNegocio, { pestanaOculta: true });
  let idCita: number | undefined;
  try {
    const cita = await reservaPendiente(request, ctx);
    idCita = cita.id_cita;
    const avisos = () =>
      page.evaluate(() =>
        (window as unknown as { __avisos: { titulo: string; cuerpo?: string; tag?: string }[] }).__avisos.map(
          ({ titulo, cuerpo, tag }) => ({ titulo, cuerpo, tag }),
        ),
      );
    await expect.poll(avisos, { timeout: 10_000 }).toEqual([
      {
        titulo: "Nueva reserva por confirmar",
        cuerpo: "Llegó una reserva desde la app. Ábrela en PetCat para confirmarla.",
        tag: `cita-${cita.id_cita}`,
      },
    ]);
    await page.evaluate(() =>
      (window as unknown as { __avisos: { abrir: () => void }[] }).__avisos[0]!.abrir(),
    );
    await expect(page).toHaveURL(new RegExp(`/agenda\\?fecha=${cita.fecha}&cita=${cita.id_cita}$`));
  } finally {
    await contexto.close();
    if (idCita) await cancelarSiActiva(request, ctx, idCita);
  }
});
