import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notificacion } from "@/api/notificaciones";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, http, HttpResponse, ok, servidor } from "@/test/servidor";
import { notificacionDemo, paginaNotificaciones } from "@/test/notificaciones";
import { socketFalso } from "@/test/socketFalso";

const resena = notificacionDemo({
  id_notificacion: 2,
  tipo: "resena_nueva",
  titulo: "Nueva reseña",
  mensaje: "Camilo Torres calificó con 4 estrellas Baño básico.",
  datos: { tipo: "resena_nueva", id_negocio: 1, id_resena: 9 },
  leida: true,
});

/** La API de notificaciones del panel: guarda las consultas y lo que se marcó. */
function conNotificaciones(lista: Notificacion[] = [notificacionDemo(), resena], total = 1) {
  const registro = { consultas: [] as URLSearchParams[], leidas: [] as number[], leerTodas: [] as string[] };
  servidor.use(
    http.get(`${API}/notificaciones/no-leidas`, ({ request }) => {
      registro.consultas.push(new URL(request.url).searchParams);
      return ok({ total, por_destino: { dueno: 4, negocio: total } });
    }),
    http.get(`${API}/notificaciones`, ({ request }) => {
      registro.consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json(paginaNotificaciones(lista));
    }),
    http.patch(`${API}/notificaciones/:id/leida`, ({ params }) => {
      registro.leidas.push(Number(params.id));
      return ok({ ...lista[0], leida: true });
    }),
    http.post(`${API}/notificaciones/leer-todas`, ({ request }) => {
      registro.leerTodas.push(new URL(request.url).search);
      return ok({ actualizadas: total });
    }),
    // Lo que piden las pantallas a las que llevan las notificaciones.
    http.get(`${API}/negocios/1/citas`, () => ok([])),
    http.get(`${API}/citas/77`, () =>
      HttpResponse.json({ success: false, message: "No encontrada" }, { status: 404 }),
    ),
  );
  return registro;
}

const campana = () => screen.getByRole("button", { name: /^Notificaciones/ });

beforeEach(() => __reiniciarSesionParaPruebas());

describe("E5 · Campana", () => {
  it("cuenta solo las del panel, lo pone en el título y lista las recientes", async () => {
    const registro = conNotificaciones();
    renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();

    expect(await screen.findByRole("button", { name: "Notificaciones: 1 sin leer" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("(1) PetCat · Panel"));
    expect(registro.consultas[0]?.get("destino")).toBe("negocio");

    await user.click(campana());
    const panel = await screen.findByRole("dialog", { name: "Notificaciones" });
    expect(await within(panel).findByText("Nueva cita por confirmar")).toBeInTheDocument();
    expect(within(panel).getByText("Nueva reseña")).toBeInTheDocument();
    expect(within(panel).getAllByRole("img", { name: "Sin leer" })).toHaveLength(1);
    expect(registro.consultas.at(-1)?.get("destino")).toBe("negocio");
    expect(within(panel).getByRole("link", { name: "Ver todas las notificaciones" })).toHaveAttribute(
      "href",
      "/n/1/notificaciones",
    );
  });

  it("abrir una notificación la marca como leída y lleva a su pantalla", async () => {
    const registro = conNotificaciones();
    const { router } = renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Notificaciones: 1 sin leer" }));
    await user.click(await screen.findByRole("button", { name: /Nueva cita por confirmar/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/agenda"));
    expect(router.state.location.search).toBe("?fecha=2026-10-28&cita=77");
    expect(registro.leidas).toEqual([1]);

    // Una ya leída no se vuelve a marcar. (El detalle de la cita es modal: se cierra antes.)
    await user.keyboard("{Escape}");
    await user.click(campana());
    await user.click(await screen.findByRole("button", { name: /Nueva reseña/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/resenas"));
    expect(router.state.location.search).toBe("?resena=9");
    expect(registro.leidas).toEqual([1]);
  });

  it("con dos negocios muestra de cuál es; uno sin acceso avisa y no navega", async () => {
    conNotificaciones([
      notificacionDemo({ id_negocio: 4, datos: { tipo: "cita_nueva", id_cita: 5, id_negocio: 4 } }),
      notificacionDemo({
        id_notificacion: 3,
        id_negocio: 8,
        titulo: "Cita cancelada",
        tipo: "cita_cancelada",
      }),
    ]);
    const usuario = usuarioDemo({
      negocios: [negocioDemo(), negocioDemo({ id_negocio: 4, nombre: "Salud Animal 24h" })],
    });
    const { router } = renderRuta("/n/1/mi-perfil", { usuario });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Notificaciones/ }));
    expect(await screen.findByText(/· Salud Animal 24h/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cita cancelada/ }));
    expect(
      await screen.findByText("Ya no tienes acceso al negocio de esta notificación."),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/n/1/mi-perfil");
  });

  it("marca todas las del panel como leídas", async () => {
    const registro = conNotificaciones();
    renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Notificaciones: 1 sin leer" }));
    await user.click(await screen.findByRole("button", { name: "Marcar todas como leídas" }));
    expect(await screen.findByText("1 notificación marcada como leída")).toBeInTheDocument();
    expect(registro.leerTodas).toEqual(["?destino=negocio"]);
  });
});

describe("Notificaciones en tiempo real", () => {
  it("una del panel sube el contador; una de la app del dueño no; otra sesión que marcó lo corrige", async () => {
    conNotificaciones([], 2);
    renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    await screen.findByRole("button", { name: "Notificaciones: 2 sin leer" });
    const socket = socketFalso();
    socket.conectar();

    socket.recibir("notificacion", notificacionDemo({ id_notificacion: 10 }));
    expect(await screen.findByRole("button", { name: "Notificaciones: 3 sin leer" })).toBeInTheDocument();
    expect(document.title).toBe("(3) PetCat · Panel");

    socket.recibir(
      "notificacion",
      notificacionDemo({ id_notificacion: 11, destino: "dueno", tipo: "vacuna_proxima" }),
    );
    expect(screen.getByRole("button", { name: "Notificaciones: 3 sin leer" })).toBeInTheDocument();

    socket.recibir("notificaciones_leidas", { no_leidas: 4, por_destino: { dueno: 4, negocio: 0 } });
    expect(await screen.findByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
    expect(document.title).toBe("PetCat · Panel");
  });
});

describe("Avisos del navegador", () => {
  /** Notification API simulada: guarda los avisos creados. */
  class NotificacionFalsa {
    static permission: NotificationPermission = "default";
    static creadas: NotificacionFalsa[] = [];
    static requestPermission = vi.fn(async () => {
      NotificacionFalsa.permission = "granted";
      return "granted" as NotificationPermission;
    });
    onclick: (() => void) | null = null;
    cerrada = false;
    readonly titulo: string;
    readonly opciones: NotificationOptions;
    constructor(titulo: string, opciones: NotificationOptions) {
      this.titulo = titulo;
      this.opciones = opciones;
      NotificacionFalsa.creadas.push(this);
    }
    close() {
      this.cerrada = true;
    }
  }
  let visibilidad: DocumentVisibilityState = "hidden";

  beforeEach(() => {
    NotificacionFalsa.permission = "default";
    NotificacionFalsa.creadas = [];
    localStorage.clear();
    vi.stubGlobal("Notification", NotificacionFalsa);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilidad);
    vi.spyOn(window, "focus").mockImplementation(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("solo si el usuario los activa; con la pestaña oculta, una reserva por confirmar se avisa sin datos y abre la cita", async () => {
    conNotificaciones([], 0);
    const { router } = renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const socket = socketFalso();
    socket.conectar();
    await screen.findByRole("button", { name: "Notificaciones" });

    // Sin activar: no se pide permiso ni se avisa.
    visibilidad = "hidden";
    socket.recibir("notificacion", notificacionDemo({ id_notificacion: 20 }));
    expect(NotificacionFalsa.creadas).toHaveLength(0);
    expect(NotificacionFalsa.requestPermission).not.toHaveBeenCalled();

    await user.click(campana());
    await user.click(await screen.findByRole("button", { name: "Activar avisos en este navegador" }));
    expect(await screen.findByText("Avisos activos en este navegador")).toBeInTheDocument();
    expect(NotificacionFalsa.requestPermission).toHaveBeenCalledTimes(1);

    socket.recibir("notificacion", notificacionDemo({ id_notificacion: 21 }));
    expect(NotificacionFalsa.creadas).toHaveLength(1);
    const [creado] = NotificacionFalsa.creadas;
    expect(creado!.titulo).toBe("Nueva reserva por confirmar");
    expect(creado!.opciones.body).toBe("Llegó una reserva desde la app. Ábrela en PetCat para confirmarla.");
    expect(`${creado!.titulo} ${creado!.opciones.body}`).not.toMatch(/Sofía|Luna|Consulta/);
    expect(creado!.opciones.tag).toBe("cita-77");

    creado!.onclick?.();
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/agenda"));
    expect(router.state.location.search).toBe("?fecha=2026-10-28&cita=77");
    expect(creado!.cerrada).toBe(true);

    // Con la pestaña a la vista, una confirmada automáticamente o una cancelación: nada.
    visibilidad = "visible";
    socket.recibir("notificacion", notificacionDemo({ id_notificacion: 22 }));
    visibilidad = "hidden";
    socket.recibir(
      "notificacion",
      notificacionDemo({
        id_notificacion: 23,
        datos: { tipo: "cita_nueva", id_cita: 78, por_confirmar: false },
      }),
    );
    socket.recibir("notificacion", notificacionDemo({ id_notificacion: 24, tipo: "cita_cancelada" }));
    expect(NotificacionFalsa.creadas).toHaveLength(1);
  });

  it("si el navegador los bloqueó, lo explica y no ofrece activarlos", async () => {
    NotificacionFalsa.permission = "denied";
    conNotificaciones([], 0);
    renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Notificaciones" }));
    expect(await screen.findByText(/Bloqueaste los avisos de PetCat en este navegador/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Activar avisos en este navegador" }),
    ).not.toBeInTheDocument();
  });
});

describe("Todas las notificaciones", () => {
  it("lista por páginas y filtra las no leídas en la URL", async () => {
    const registro = conNotificaciones();
    const { router } = renderRuta("/n/1/notificaciones", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(
      await screen.findAllByRole("button", { name: /^(Nueva cita por confirmar|Nueva reseña)/ }),
    ).toHaveLength(2);
    await user.click(screen.getByRole("tab", { name: /No leídas/ }));
    await waitFor(() => expect(router.state.location.search).toBe("?ver=no-leidas"));
    await waitFor(() => expect(registro.consultas.at(-1)?.get("leidas")).toBe("false"));
  });
});
