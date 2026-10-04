import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");

const norte = sedeDemo({
  id_sucursal: 5,
  nombre: "Sede Norte",
  direccion: "Cl 38 #15-10, Venecia",
  es_principal: false,
  latitud: null,
  longitud: null,
  horarios: [{ dia_semana: 2, hora_apertura: "09:00", hora_cierre: "17:00" }],
});
const gestion = gestionDemo({ sucursales: [sedeDemo(), norte] });

const suscripcion = (usadas: number, maximo: number) =>
  http.get(`${API}/negocios/1/suscripcion`, () =>
    ok({
      plan: {
        id_plan: 1,
        nombre: "Gratuito",
        limites: { sucursales: maximo, empleados: 3, citas_mes: 30, productos: 50 },
      },
      suscripcion: null,
      prueba_disponible: true,
      uso: { sucursales: { usadas, maximo }, citas_mes: { usadas: 0, maximo: 30 } },
    }),
  );

const base = (usadas = 2, maximo = 3) => [
  http.get(`${API}/negocios/1/gestion`, () => ok(gestion)),
  http.get(`${API}/auth/me`, () => ok(usuarioDemo())),
  suscripcion(usadas, maximo),
];

beforeEach(() => __reiniciarSesionParaPruebas());

describe("E2 · Sedes y horarios", () => {
  it("lista las sedes con sus etiquetas, el aviso sin ubicación y el plan", async () => {
    servidor.use(...base());
    renderRuta("/n/1/configuracion/sedes", { usuario: usuarioDemo() });
    const centro = await screen.findByRole("button", { name: /Sede Centro/ });
    expect(centro).toHaveAttribute("aria-current", "true");
    expect(centro).toHaveTextContent("Principal");
    expect(screen.getByRole("button", { name: /Sede Norte/ })).toHaveTextContent("Sin ubicación");
    expect(screen.getByText(/Sede Norte no tiene coordenadas/)).toBeInTheDocument();
    expect(await screen.findByText("Plan Gratuito: 3 sedes.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Sede Centro");
    // La principal no se puede desmarcar: para cambiarla se marca otra.
    expect(screen.getByRole("switch", { name: "Sede principal" })).toBeDisabled();
  });

  it("guarda solo lo que cambió y deja marcar otra sede como principal", async () => {
    const cuerpos: unknown[] = [];
    servidor.use(
      ...base(),
      http.patch(`${API}/sucursales/:id`, async ({ request, params }) => {
        cuerpos.push({ id: params.id, cuerpo: await request.json() });
        return ok(norte);
      }),
    );
    renderRuta("/n/1/configuracion/sedes?sede=5", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const telefono = await screen.findByLabelText("Teléfono");
    await user.clear(telefono);
    await user.type(telefono, "3009998877");
    await user.click(screen.getByRole("switch", { name: "Sede principal" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(cuerpos).toEqual([{ id: "5", cuerpo: { telefono: "3009998877", es_principal: true } }]),
    );
  });

  it("nueva sede: la crea y la deja elegida; en el límite del plan abre el diálogo", async () => {
    let creada: unknown;
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/sucursales`, async ({ request }) => {
        creada = await request.json();
        return ok(sedeDemo({ id_sucursal: 9, nombre: "Sede Sur", es_principal: false }), 201);
      }),
    );
    const { router } = renderRuta("/n/1/configuracion/sedes", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByText("Plan Gratuito: 3 sedes.");
    await user.click(screen.getByRole("button", { name: "Nueva sede" }));
    expect(router.state.location.search).toBe("?sede=nueva");
    await user.type(screen.getByLabelText("Nombre *"), "Sede Sur");
    await user.type(screen.getByLabelText("Dirección *"), "Cra 25 #10-20");
    await user.click(screen.getByRole("button", { name: "Crear sede" }));
    await waitFor(() => expect(router.state.location.search).toBe("?sede=9"));
    expect(creada).toEqual({
      nombre: "Sede Sur",
      direccion: "Cra 25 #10-20",
      telefono: "3001234567",
      latitud: null,
      longitud: null,
    });
  });

  it("con el límite de sedes alcanzado, 'Nueva sede' invita a cambiar de plan", async () => {
    servidor.use(...base(2, 2));
    renderRuta("/n/1/configuracion/sedes", { usuario: usuarioDemo() });
    await screen.findByText("Plan Gratuito: 2 sedes.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Nueva sede" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Alcanzaste el límite de tu plan");
    expect(dialogo).toHaveTextContent("Tu plan Gratuito permite 2 sedes");
  });

  it("guarda el horario y muestra las citas que quedaron fuera", async () => {
    let enviado: unknown;
    servidor.use(
      ...base(),
      http.put(`${API}/sucursales/3/horarios`, async ({ request }) => {
        enviado = await request.json();
        return ok({
          horarios: [],
          citas_afectadas: [
            {
              id_cita: 40,
              fecha: "2026-10-05",
              hora_inicio: "15:00:00",
              hora_fin: "15:30:00",
              estado: "confirmada",
              sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
              servicio: { id_servicio: 1, nombre: "Consulta general" },
              mascota: { id_mascota: 2, nombre: "Max" },
              cliente: { id_usuario: 8, nombre: "Sofía", apellido: "Gómez", telefono: "3005556677" },
            },
          ],
        });
      }),
    );
    renderRuta("/n/1/configuracion/sedes", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Guardar horario" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Quitar rango 14:00–18:00 del lunes" }));
    await user.click(screen.getByRole("button", { name: "Guardar horario" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("El horario se guardó. 1 cita está fuera de la disponibilidad");
    expect(within(dialogo).getByRole("link", { name: "3005556677" })).toHaveAttribute(
      "href",
      "tel:3005556677",
    );
    expect(dialogo).toHaveTextContent("Sofía Gómez");
    expect(enviado).toEqual({ horarios: [{ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }] });
  });

  it("desactivar: el 409 de la API se muestra en la confirmación", async () => {
    servidor.use(
      ...base(),
      http.delete(`${API}/sucursales/5`, () =>
        fallo(409, "La sucursal tiene 2 citas futuras: reprográmalas o cancélalas antes de desactivarla"),
      ),
    );
    renderRuta("/n/1/configuracion/sedes?sede=5", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Desactivar sede" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Desactivar sede" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("tiene 2 citas futuras");
  });

  it("con cambios sin guardar pregunta antes de salir", async () => {
    servidor.use(...base());
    const { router } = renderRuta("/n/1/configuracion/sedes", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Quitar rango 08:00–12:00 del lunes" }));
    await user.click(screen.getByRole("link", { name: "Perfil del negocio" }));
    expect(await screen.findByText("Tienes cambios sin guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe("/n/1/configuracion/sedes");
  });

  it("con configuracion.ver y sin editar: solo lectura", async () => {
    const lector = usuarioDemo({
      negocios: [
        negocioDemo({
          relacion: "empleado",
          rol: { id_rol: 5, nombre: "Recepción", permisos_json: { configuracion: ["ver"] } },
        }),
      ],
    });
    servidor.use(...base());
    renderRuta("/n/1/configuracion/sedes", { usuario: lector });
    expect(await screen.findByLabelText("Nombre *")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Nueva sede" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar horario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar sede" })).not.toBeInTheDocument();
  });
});
