import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Dashboard } from "@/api/dashboard";
import type { NegocioMio } from "@/api/types";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { hoyISO } from "@/lib/format";
import { citaPanelDemo } from "@/test/agenda";
import { dashboardGratuito, dashboardPro } from "@/test/dashboard";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";
import { socketFalso } from "@/test/socketFalso";
import { suscripcionDemo } from "@/test/suscripcion";
import { rangoDe } from "../periodos";

/** Responde el dashboard y guarda los parámetros de cada consulta. */
function conDashboard(datos: Dashboard | ((url: URL) => Response | Dashboard)) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get(`${API}/negocios/1/dashboard`, ({ request }) => {
      const url = new URL(request.url);
      consultas.push(url.searchParams);
      const respuesta = typeof datos === "function" ? datos(url) : datos;
      return respuesta instanceof Response ? respuesta : ok(respuesta);
    }),
    http.get(`${API}/negocios/1/citas`, () =>
      ok([
        citaPanelDemo({ id_cita: 7, hora_inicio: "11:00", estado: "en_curso" }),
        citaPanelDemo({
          id_cita: 8,
          hora_inicio: "08:00",
          mascota: { id_mascota: 5, nombre: "Luna", especie: "gato" },
          estado: "pendiente",
        }),
      ]),
    ),
    http.get(`${API}/negocios/1/suscripcion`, () => ok(suscripcionDemo())),
    http.get(`${API}/negocios/1/gestion`, () =>
      ok(
        gestionDemo({
          sucursales: [sedeDemo(), sedeDemo({ id_sucursal: 4, nombre: "Sede Norte", es_principal: false })],
        }),
      ),
    ),
  );
  return consultas;
}

const empleado = (permisos: Record<string, string[]>): NegocioMio =>
  negocioDemo({
    relacion: "empleado",
    id_empleado: 4,
    rol: { id_rol: 9, nombre: "Coordinador", permisos_json: permisos },
  });

beforeEach(() => __reiniciarSesionParaPruebas());

describe("B2 · Dashboard en el plan Gratuito", () => {
  it("muestra los indicadores, las citas de hoy, lo que requiere atención y las secciones avanzadas bloqueadas", async () => {
    conDashboard(dashboardGratuito());
    renderRuta("/n/1/dashboard", { usuario: usuarioDemo() });

    const indicadores = await screen.findByRole("region", { name: "Indicadores del periodo" });
    expect(within(indicadores).getByText("3 por confirmar")).toBeInTheDocument();
    expect(within(indicadores).getByText(/343\.000/)).toBeInTheDocument();
    // Sin estadísticas avanzadas no hay comparación: nada de "vs periodo anterior".
    expect(within(indicadores).getByText("6 citas completadas")).toBeInTheDocument();
    expect(within(indicadores).getByText("2 de 8 citas")).toBeInTheDocument();
    expect(within(indicadores).queryByText(/vs periodo anterior/)).not.toBeInTheDocument();
    expect(within(indicadores).getByText(/2 sin responder/)).toBeInTheDocument();
    expect(screen.getByText("Plan Gratuito · 26 de 30 citas este mes")).toBeInTheDocument();
    expect(screen.getByText(/no pagos verificados/)).toBeInTheDocument();

    // Citas de hoy en orden, cada una abre su detalle en la agenda.
    const enlaces = await screen.findAllByRole("link", { name: /— Consulta general/ });
    expect(enlaces.map((e) => e.textContent)).toEqual([
      expect.stringContaining("08:00Luna"),
      expect.stringContaining("11:00Max"),
    ]);
    expect(enlaces[0]).toHaveAttribute("href", `/n/1/agenda?fecha=${hoyISO()}&cita=8`);

    expect(screen.getByText("Requiere tu atención")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /2 reseñas sin responder/ })).toHaveAttribute(
      "href",
      "/n/1/resenas",
    );
    expect(screen.getByText("5 mascotas con vacunas vencidas en los últimos 30 días")).toBeInTheDocument();

    const analisis = screen.getByRole("region", { name: "Análisis del periodo" });
    expect(within(analisis).getByText("Servicios más pedidos")).toBeInTheDocument();
    expect(within(analisis).getByText("5 · $305 mil")).toBeInTheDocument();
    expect(within(analisis).getAllByText("Disponible en el plan Pro")).toHaveLength(3);
    expect(await within(analisis).findAllByRole("button", { name: "Probar Pro 14 días" })).toHaveLength(3);
  });

  it("activa la confirmación automática desde la sugerencia de las citas perdidas", async () => {
    conDashboard(dashboardGratuito());
    let cuerpo: unknown;
    servidor.use(
      http.patch(`${API}/negocios/1`, async ({ request }) => {
        cuerpo = await request.json();
        return ok(gestionDemo({ confirmacion_automatica: true }));
      }),
      http.get(`${API}/auth/me`, () => ok(usuarioDemo())),
    );
    renderRuta("/n/1/dashboard", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(await screen.findByText("2 citas perdidas por no confirmar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Activar confirmación automática" }));
    expect(await screen.findByText("Confirmación automática activada")).toBeInTheDocument();
    expect(cuerpo).toEqual({ confirmacion_automatica: true });
  });

  it("un rango mayor al del plan se muestra como invitación a Pro y se puede volver a 30 días", async () => {
    const consultas = conDashboard((url) =>
      url.searchParams.get("desde") === rangoDe("12m", hoyISO()).desde
        ? fallo(422, "Tu plan Gratuito permite ver hasta 92 días", {
            hasta: "El rango máximo es de 92 días",
            plan_requerido: "Pro",
          })
        : dashboardGratuito(),
    );
    const { router } = renderRuta("/n/1/dashboard?periodo=12m", { usuario: usuarioDemo() });
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Tu plan Gratuito permite ver hasta 92 días" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Con el plan Pro consultas hasta 12 meses de historia/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Probar Pro 14 días" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver los últimos 30 días" }));
    expect(await screen.findByRole("region", { name: "Indicadores del periodo" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
    expect(consultas.at(-1)?.get("desde")).toBe(rangoDe("30", hoyISO()).desde);
  });

  it("sin citas.ver ni configuracion.editar: sin citas de hoy ni botón para activar", async () => {
    conDashboard(dashboardGratuito());
    renderRuta("/n/1/dashboard", { usuario: usuarioDemo({ negocios: [empleado({ reportes: ["ver"] })] }) });
    expect(
      await screen.findByText("Pídele al propietario que la active en Configuración."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Citas de hoy")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar confirmación automática" })).not.toBeInTheDocument();
    // Las pendientes salen del dashboard y no enlazan a la agenda.
    expect(screen.getByText(/3 citas pendientes por confirmar/).closest("a")).toBeNull();
  });

  it("sin reportes.ver muestra el estado sin permiso", async () => {
    renderRuta("/n/1/dashboard", { usuario: usuarioDemo({ negocios: [empleado({ citas: ["ver"] })] }) });
    expect(await screen.findByText(/No tienes permiso/)).toBeInTheDocument();
  });
});

describe("B1 · Dashboard con estadísticas avanzadas", () => {
  it("compara con el periodo anterior y muestra tendencia, profesionales, sedes, horas pico y recurrencia", async () => {
    conDashboard(dashboardPro());
    renderRuta("/n/1/dashboard", { usuario: usuarioDemo() });

    const indicadores = await screen.findByRole("region", { name: "Indicadores del periodo" });
    expect(within(indicadores).getByText("12 % vs periodo anterior")).toBeInTheDocument();
    // La inasistencia baja 2 puntos: es bueno.
    expect(within(indicadores).getByText("2 pts vs periodo anterior")).toHaveClass("text-primary-dark");

    const analisis = screen.getByRole("region", { name: "Análisis del periodo" });
    expect(within(analisis).getByRole("heading", { name: "Completadas por semana" })).toBeInTheDocument();
    expect(within(analisis).getByText("18 % vs periodo anterior")).toBeInTheDocument();
    expect(within(analisis).getByRole("table", { name: "Citas completadas por semana" })).toBeInTheDocument();
    expect(within(analisis).getByText("Semana del 28 de septiembre")).toBeInTheDocument();
    expect(within(analisis).getByText("Carlos Martínez")).toBeInTheDocument();
    expect(within(analisis).getByText("Sin profesional")).toBeInTheDocument();
    expect(within(analisis).getByText("9 citas · $930 mil · 11,1 % inasist.")).toBeInTheDocument();
    expect(within(analisis).getByText("Martes · 9:00–10:00")).toBeInTheDocument();
    expect(
      within(analisis).getByText(/1 de 4 clientes atendidos volvió dos veces o más/),
    ).toBeInTheDocument();
    expect(within(analisis).queryByText("Disponible en el plan Pro")).not.toBeInTheDocument();
    expect(screen.queryByText(/citas perdidas/)).not.toBeInTheDocument();
  });

  it("el periodo y la sede van en la URL y en la consulta", async () => {
    const consultas = conDashboard(dashboardPro());
    const { router } = renderRuta("/n/1/dashboard", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByRole("region", { name: "Indicadores del periodo" });

    await user.click(screen.getByRole("combobox", { name: "Periodo" }));
    await user.click(await screen.findByRole("option", { name: "Últimos 7 días" }));
    await waitFor(() => expect(router.state.location.search).toBe("?periodo=7"));
    await waitFor(() => expect(consultas.at(-1)?.get("desde")).toBe(rangoDe("7", hoyISO()).desde));

    await user.click(screen.getByRole("combobox", { name: "Sede" }));
    await user.click(await screen.findByRole("option", { name: "Sede Norte" }));
    await waitFor(() => expect(consultas.at(-1)?.get("id_sucursal")).toBe("4"));
    expect(router.state.location.search).toBe("?periodo=7&sede=4");
  });
});

describe("Dashboard en tiempo real", () => {
  it("un cambio en la agenda recarga el dashboard", async () => {
    const consultas = conDashboard(dashboardGratuito());
    renderRuta("/n/1/dashboard", { usuario: usuarioDemo() });
    await screen.findByRole("region", { name: "Indicadores del periodo" });
    const socket = socketFalso();
    socket.conectar();
    const antes = consultas.length;
    socket.recibir("agenda_actualizada", {
      id_negocio: 1,
      accion: "estado",
      id_cita: 7,
      fechas: [hoyISO()],
      por: 99,
    });
    await waitFor(() => expect(consultas.length).toBeGreaterThan(antes));
  });
});
