import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import { AccessibilityInfo, Alert, type AlertButton } from "react-native";

import { refreshStorage } from "@/api/refreshStorage";
import { hoyEnBogota, partesEnBogota } from "@/lib/fechas";

import { reiniciarSesion, renderApp } from "../../../test/app";
import {
  API,
  citaDemo,
  fallo,
  horariosDemo,
  mascotaDemo,
  negocioPublicoDemo,
  ok,
  perfilDemo,
  sesionDemo,
} from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { sumarDias } from "./logica";

let anuncios: string[];
let consultas: URLSearchParams[];
let reservas: unknown[];

const luna = mascotaDemo();
const michi = mascotaDemo({ id_mascota: 2, nombre: "Michi", especie: "gato" });

/** Una fecha futura que no cae en esta semana (lejos de las 2 horas de aviso). */
const enDiezDias = sumarDias(hoyEnBogota(), 10);

beforeEach(async () => {
  await reiniciarSesion();
  anuncios = [];
  consultas = [];
  reservas = [];
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((m) => void anuncios.push(m));
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

type Opciones = {
  mascotas?: unknown[];
  negocio?: Record<string, unknown>;
  /** Horas libres según la consulta (por defecto, 8:00, 8:30 y 2:00 p. m. cualquier día). */
  horas?: (q: URLSearchParams) => string[];
  mias?: Record<string, unknown[]>;
};

function conSesion({ mascotas = [luna, michi], negocio = {}, horas, mias = {} }: Opciones = {}) {
  void refreshStorage.guardar("refresh-0");
  server.use(
    http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
    http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    http.get(`${API}/mascotas`, () => ok(mascotas)),
    http.get(`${API}/negocios/:id`, () => ok(negocioPublicoDemo(negocio))),
    http.get(`${API}/citas/horarios-libres`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      consultas.push(q);
      return ok(horariosDemo(q.get("fecha")!, horas ? horas(q) : ["08:00", "08:30", "14:00"]));
    }),
    http.get(`${API}/citas/mias`, ({ request }) => {
      const alcance = new URL(request.url).searchParams.get("alcance") ?? "proximas";
      const data = mias[alcance] ?? [];
      return HttpResponse.json({
        success: true,
        message: "OK",
        data,
        meta: { total: data.length, page: 1, limit: 20, totalPages: 1, hasNext: false },
      });
    }),
  );
}

/** Responde a un Alert.alert tocando el botón con ese texto (y guarda el mensaje). */
function responderAlerta(texto: string) {
  return jest.spyOn(Alert, "alert").mockImplementation((_t, _m, botones?: AlertButton[]) => {
    botones?.find((b) => b.text === texto)?.onPress?.();
  });
}

/** GET /citas/:id solo con un id numérico: si no, sigue al siguiente handler (horarios-libres, mias). */
function detalle(cita: (id: number) => unknown) {
  return http.get(`${API}/citas/:id`, ({ params }) =>
    /^\d+$/.test(String(params.id)) ? ok(cita(Number(params.id))) : undefined,
  );
}

const confirmar = () => screen.getByRole("button", { name: "Confirmar cita" });

describe("M12 · Agendar cita", () => {
  it("de punta a punta: hora, confirmar, solicitud enviada y Mis citas", async () => {
    const reservada = citaDemo({ fecha: enDiezDias, estado: "pendiente" });
    conSesion({ mias: { proximas: [reservada] } });
    server.use(
      http.post(`${API}/citas`, async ({ request }) => {
        reservas.push(await request.json());
        return ok(reservada, "Cita solicitada: el negocio debe confirmarla");
      }),
      detalle(() => reservada),
    );
    await renderApp("/negocios/1/agendar");

    // Mascota preseleccionada (la primera que el servicio atiende), servicio y horas del primer día abierto.
    expect(await screen.findByRole("radio", { name: "Luna", checked: true })).toBeOnTheScreen();
    expect(screen.getByText("Consulta general")).toBeOnTheScreen();
    expect(await screen.findByRole("radio", { name: "8:30 a. m." })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Mañana" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Tarde" })).toBeOnTheScreen();
    expect(confirmar()).toBeDisabled();
    const fecha = consultas[0]!.get("fecha")!;
    expect(consultas[0]!.get("id_servicio")).toBe("1");
    expect(consultas[0]!.get("id_sucursal")).toBe("10");

    await fireEvent.press(screen.getByRole("radio", { name: "Michi" }));
    await fireEvent.press(screen.getByRole("radio", { name: "8:30 a. m." }));
    expect(screen.getByRole("radio", { name: "8:30 a. m.", checked: true })).toBeOnTheScreen();
    expect(screen.getByLabelText(/, 8:30 a\. m\. \$45\.000$/)).toBeOnTheScreen();
    await fireEvent.press(confirmar());

    expect(await screen.findByRole("header", { name: "¡Solicitud enviada!" })).toBeOnTheScreen();
    expect(reservas).toEqual([
      { id_servicio: 1, id_sucursal: 10, fecha, hora_inicio: "08:30", id_mascota: 2 },
    ]);
    expect(screen).toHavePathname("/cita/50/confirmada");
    expect(
      screen.getByText("Clínica Vet Sabanas debe confirmarla. Verás el estado en Mis citas."),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Cancela con al menos 2 horas de anticipación/)).toBeOnTheScreen();
    // Confeti solo sin "Reducir movimiento".
    expect(await screen.findByTestId("confeti", { includeHiddenElements: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ver mis citas" }));
    expect(screen).toHavePathname("/citas");
    expect(await screen.findByRole("button", { name: /^Consulta general para Luna\./ })).toBeOnTheScreen();
  });

  it("si la hora se ocupó al confirmar (409): lo dice y vuelve a pedir las horas libres", async () => {
    let ocupada = false;
    conSesion({ horas: () => (ocupada ? ["08:00", "14:00"] : ["08:00", "08:30", "14:00"]) });
    server.use(
      http.post(`${API}/citas`, () => {
        ocupada = true;
        return fallo(409, "El horario ya no está disponible: elige otro");
      }),
    );
    await renderApp("/negocios/1/agendar");
    await fireEvent.press(await screen.findByRole("radio", { name: "8:30 a. m." }));
    const antes = consultas.length;
    await fireEvent.press(confirmar());

    expect(
      await screen.findByText("Esa hora se acaba de ocupar. Elige otra de las horas libres."),
    ).toBeOnTheScreen();
    expect(anuncios).toContain("Esa hora se acaba de ocupar. Elige otra de las horas libres.");
    await waitFor(() => expect(screen.queryByRole("radio", { name: "8:30 a. m." })).toBeNull());
    expect(consultas.length).toBeGreaterThan(antes);
    expect(screen.getByRole("radio", { name: "8:00 a. m." })).toBeOnTheScreen();
    expect(confirmar()).toBeDisabled();
    expect(screen).toHavePathname("/negocios/1/agendar");
  });

  it("sin respuesta al confirmar: pide revisar Mis citas (no reintenta solo)", async () => {
    conSesion();
    let intentos = 0;
    server.use(
      http.post(`${API}/citas`, () => {
        intentos++;
        return Response.error();
      }),
    );
    await renderApp("/negocios/1/agendar");
    await fireEvent.press(await screen.findByRole("radio", { name: "8:00 a. m." }));
    await fireEvent.press(confirmar());
    expect(await screen.findByText(/Revisa Mis citas antes de intentarlo de nuevo/)).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(4_000));
    expect(intentos).toBe(1);
  });

  it("día sin horas: el motivo de la API; los cerrados no se pueden elegir", async () => {
    conSesion({ horas: () => [] });
    await renderApp("/negocios/1/agendar");
    expect(
      await screen.findByText("No hay horarios disponibles para esa fecha. Prueba con otro día."),
    ).toBeOnTheScreen();
    // La sede de la demo cierra sábados y domingos.
    const cerrados = screen.getAllByRole("radio", { name: /^(Sábado|Domingo) .*\. Cerrado$/ });
    expect(cerrados.length).toBeGreaterThanOrEqual(2);
    expect(cerrados[0]).toBeDisabled();
  });

  it("al cambiar de día pide las horas de ese día", async () => {
    conSesion();
    await renderApp("/negocios/1/agendar");
    await screen.findByRole("radio", { name: "8:00 a. m." });
    const abiertos = screen.getAllByRole("radio", { name: /^(Lunes|Martes|Miércoles|Jueves|Viernes) / });
    await fireEvent.press(abiertos[1]!);
    await waitFor(() => expect(consultas.at(-1)!.get("fecha")).not.toBe(consultas[0]!.get("fecha")));
  });

  it("mascotas que el servicio no atiende: deshabilitadas con el motivo", async () => {
    const soloPerros = negocioPublicoDemo().servicios.map((s) => ({ ...s, tipo_mascota: ["perro"] }));
    conSesion({ negocio: { servicios: soloPerros } });
    await renderApp("/negocios/1/agendar");
    expect(
      await screen.findByRole("radio", { name: "Michi. Este servicio no atiende gatos" }),
    ).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Luna", checked: true })).toBeOnTheScreen();
  });

  it("cambiar de servicio y de sede (con varias sedes)", async () => {
    const principal = negocioPublicoDemo().sucursales[0]!;
    conSesion({
      negocio: {
        sucursales: [principal, { ...principal, id_sucursal: 11, nombre: "Sede Norte", es_principal: false }],
      },
    });
    await renderApp("/negocios/1/agendar?servicio=2");
    expect(await screen.findByText("Vacunación")).toBeOnTheScreen();
    await screen.findByRole("radio", { name: "8:00 a. m." });
    expect(consultas.at(-1)!.get("id_servicio")).toBe("2");

    await fireEvent.press(screen.getByRole("button", { name: "Sede Norte" }));
    await waitFor(() => expect(consultas.at(-1)!.get("id_sucursal")).toBe("11"));

    await fireEvent.press(screen.getByRole("button", { name: "Cambiar servicio" }));
    await fireEvent.press(screen.getByRole("radio", { name: /^Consulta general\./ }));
    await waitFor(() => expect(consultas.at(-1)!.get("id_servicio")).toBe("1"));
  });

  it("sin mascotas: invita a registrar una", async () => {
    conSesion({ mascotas: [] });
    await renderApp("/negocios/1/agendar");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar mascota" }));
    expect(screen).toHavePathname("/mascotas/nueva");
  });

  it("con Reducir movimiento, la confirmación no tiene confeti", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const cita = citaDemo({ fecha: enDiezDias, estado: "confirmada" });
    conSesion();
    server.use(detalle(() => cita));
    await renderApp("/cita/50/confirmada");
    expect(await screen.findByRole("header", { name: "¡Cita agendada!" })).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId("confeti", { includeHiddenElements: true })).toBeNull();
  });
});

describe("M17 · Mis citas", () => {
  it("próximas agrupadas, con Cómo llegar, Reprogramar y Cancelar; pasadas aparte", async () => {
    const proxima = citaDemo({ fecha: enDiezDias, estado: "confirmada" });
    const pasada = citaDemo({ id_cita: 40, fecha: sumarDias(hoyEnBogota(), -30), estado: "completada" });
    conSesion({ mias: { proximas: [proxima], pasadas: [pasada] } });
    await renderApp("/citas");

    expect(
      await screen.findByRole("button", { name: /^Consulta general para Luna\..*Confirmada\.$/ }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cómo llegar a Clínica Vet Sabanas" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reprogramar Consulta general de Luna" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancelar Consulta general de Luna" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: "Pasadas" }));
    expect(await screen.findByRole("button", { name: /Completada\.$/ })).toBeOnTheScreen();
    // Las pasadas no tienen acciones.
    expect(screen.queryByRole("button", { name: /^Cancelar / })).toBeNull();
  });

  it("cancelar pide confirmación y avisa si es tardía", async () => {
    // En una hora: menos de 2 horas, cancelación tardía.
    const p = partesEnBogota(new Date(Date.now() + 60 * 60 * 1000));
    const dos = (n: number) => String(n).padStart(2, "0");
    const pronto = citaDemo({
      fecha: `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`,
      hora_inicio: `${dos(p.hora)}:${dos(p.minuto)}`,
      estado: "confirmada",
    });
    let canceladas = 0;
    conSesion({ mias: { proximas: [pronto] } });
    server.use(
      http.post(`${API}/citas/:id/cancelar`, () => {
        canceladas++;
        return ok({ ...pronto, estado: "cancelada" });
      }),
    );
    const alerta = responderAlerta("Sí, cancelar");
    await renderApp("/citas");

    // Con menos de 2 horas ya no se reprograma.
    expect(
      await screen.findByRole("button", { name: "Cancelar Consulta general de Luna" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Reprogramar / })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar Consulta general de Luna" }));

    expect(alerta).toHaveBeenCalledWith(
      "¿Cancelar la cita?",
      expect.stringContaining("quedará como cancelación tardía"),
      expect.any(Array),
    );
    await waitFor(() => expect(canceladas).toBe(1));
    await waitFor(() => expect(anuncios).toContain("Cita cancelada"));
  });

  it("vacía y con error", async () => {
    conSesion();
    await renderApp("/citas");
    expect(await screen.findByText("No tienes citas próximas")).toBeOnTheScreen();

    server.use(http.get(`${API}/citas/mias`, () => fallo(500, "x")));
    await fireEvent.press(screen.getByRole("radio", { name: "Pasadas" }));
    await act(() => jest.advanceTimersByTimeAsync(4_000));
    expect(await screen.findByText("No pudimos cargar esto")).toBeOnTheScreen();
  });

  it("reprogramar: mismas mascota y servicio, nueva hora", async () => {
    const original = citaDemo({ fecha: enDiezDias, estado: "confirmada" });
    const nueva = citaDemo({
      id_cita: 51,
      fecha: enDiezDias,
      hora_inicio: "14:00",
      estado: "pendiente",
      id_cita_origen: 50,
    });
    let cuerpo: unknown;
    conSesion();
    server.use(
      detalle((id) => (id === 51 ? nueva : original)),
      http.post(`${API}/citas/:id/reprogramar`, async ({ request }) => {
        cuerpo = await request.json();
        return ok(nueva, "Cita reprogramada");
      }),
    );
    await renderApp("/cita/50/reprogramar");

    expect(await screen.findByRole("header", { name: "Reprogramar cita" })).toBeOnTheScreen();
    // No se elige mascota ni servicio: son los de la cita.
    expect(screen.queryByRole("radio", { name: "Luna" })).toBeNull();
    await fireEvent.press(await screen.findByRole("radio", { name: "2:00 p. m." }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar cambio" }));

    expect(await screen.findByRole("header", { name: "¡Cita reprogramada!" })).toBeOnTheScreen();
    expect(cuerpo).toEqual({ fecha: consultas.at(-1)!.get("fecha"), hora_inicio: "14:00" });
  });

  it("detalle: datos, aviso de confirmación pendiente y cancelar", async () => {
    const cita = citaDemo({
      fecha: enDiezDias,
      estado: "pendiente",
      confirmar_antes_de: `${sumarDias(enDiezDias, -1)} 15:00:00`,
    });
    conSesion();
    server.use(detalle(() => cita));
    await renderApp("/cita/50");
    expect(await screen.findByLabelText("Te atiende: Carlos Pérez")).toBeOnTheScreen();
    expect(
      screen.getByText(/debe confirmarla antes del .*, 3:00 p\. m\. Si no lo hace, se cancela sola\./),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reprogramar" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancelar cita" })).toBeOnTheScreen();
  });
});

describe("Inicio", () => {
  it("la próxima cita abre su detalle", async () => {
    const conCita = mascotaDemo({
      resumen: {
        estado_vacunas: "sin_vacunas",
        vacunas: { vigentes: 0, al_dia: 0, proximas: 0, vencidas: 0 },
        proximos_eventos: [],
        proxima_cita: {
          id_cita: 50,
          fecha: enDiezDias,
          hora_inicio: "08:30",
          estado: "confirmada",
          servicio: { id_servicio: 1, nombre: "Consulta general" },
          negocio: { id_negocio: 1, nombre: "Clínica Vet Sabanas" },
        },
      },
    });
    conSesion({ mascotas: [conCita] });
    server.use(detalle(() => citaDemo({ fecha: enDiezDias, estado: "confirmada" })));
    await renderApp("/");
    await fireEvent.press(await screen.findByRole("button", { name: /^Consulta general para Luna/ }));
    expect(screen).toHavePathname("/cita/50");
    expect(await screen.findByLabelText("Te atiende: Carlos Pérez")).toBeOnTheScreen();
  });
});
