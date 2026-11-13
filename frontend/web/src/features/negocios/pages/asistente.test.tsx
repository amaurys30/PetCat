import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import type { NegocioMio } from "@/api/types";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

// La sede se ubica con las coordenadas manuales (respaldo del mapa).

const plan = (nombre: string, sucursales: number, empleados: number, citas_mes: number) => ({
  id_plan: 1,
  nombre,
  descripcion: null,
  precio_mensual: 0,
  precio_anual: 0,
  limites: { sucursales, empleados, citas_mes, productos: 50 },
  caracteristicas: {},
});

const nuevo = (pendiente: NegocioMio["configuracion_pendiente"], cambios: Partial<NegocioMio> = {}) =>
  negocioDemo({ id_negocio: 7, nombre: "Patitas Norte", configuracion_pendiente: pendiente, ...cambios });

/** /auth/me que va cambiando a medida que avanza el asistente. */
const perfil = { negocios: [] as NegocioMio[] };
const conPerfil = () => http.get(`${API}/auth/me`, () => ok(usuarioDemo({ negocios: perfil.negocios })));

beforeEach(() => {
  __reiniciarSesionParaPruebas();
  perfil.negocios = [];
});

describe("A6 · Crear negocio", () => {
  it("paso 1: muestra el plan Gratuito de la API, crea el negocio y sigue con la sede", async () => {
    let cuerpo: unknown;
    servidor.use(
      http.get(`${API}/planes`, () => ok([plan("Gratuito", 1, 3, 30), plan("Pro", 3, -1, -1)])),
      http.post(`${API}/negocios`, async ({ request }) => {
        cuerpo = await request.json();
        perfil.negocios = [nuevo("sede")];
        return ok(gestionDemo({ id_negocio: 7 }), 201);
      }),
      conPerfil(),
      http.get(`${API}/negocios/7/gestion`, () =>
        ok(gestionDemo({ id_negocio: 7, sucursales: [], direccion: null, latitud: null, longitud: null })),
      ),
    );
    const { router } = renderRuta("/negocios/nuevo", {
      usuario: usuarioDemo({ negocios: [], telefono: null }),
    });
    expect(
      await screen.findByText(/Empiezas en el plan Gratuito: 1 sede, 3 empleados, 30 citas al mes/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo de contacto")).toHaveValue("propietario@petcat.test");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre del negocio *"), "Patitas Norte");
    await user.selectOptions(screen.getByLabelText("Tipo de negocio *"), "peluqueria_canina");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/negocios/7/configurar"));
    expect(cuerpo).toEqual({
      nombre: "Patitas Norte",
      tipo: "peluqueria_canina",
      email: "propietario@petcat.test",
      ciudad: "Sincelejo",
    });
    expect(await screen.findByLabelText("Nombre de la sede *")).toHaveValue("Sede principal");
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Sede principal");
  });

  it("paso 2: crea la sede principal y copia la dirección al negocio que no tenía", async () => {
    perfil.negocios = [nuevo("sede")];
    let sede: unknown;
    let negocio: unknown;
    servidor.use(
      conPerfil(),
      http.get(`${API}/negocios/7/gestion`, () =>
        ok(gestionDemo({ id_negocio: 7, sucursales: [], direccion: null, latitud: null, longitud: null })),
      ),
      http.post(`${API}/negocios/7/sucursales`, async ({ request }) => {
        sede = await request.json();
        perfil.negocios = [nuevo("horarios")];
        return ok(sedeDemo({ id_negocio: 7 }), 201);
      }),
      http.patch(`${API}/negocios/7`, async ({ request }) => {
        negocio = await request.json();
        return ok(gestionDemo({ id_negocio: 7 }));
      }),
    );
    const { router } = renderRuta("/negocios/7/configurar", {
      usuario: usuarioDemo({ negocios: perfil.negocios }),
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Dirección *"), "Cra 19 #22-35");
    await user.click(screen.getByRole("button", { name: "Escribir coordenadas" }));
    await user.type(screen.getByLabelText("Latitud"), "9.30472");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(await screen.findByText("Escribe también la longitud")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Longitud"), "-75.39778");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await waitFor(() => expect(router.state.location.search).toBe("?paso=horarios"));
    expect(sede).toEqual({
      nombre: "Sede principal",
      direccion: "Cra 19 #22-35",
      telefono: "3001234567",
      latitud: 9.30472,
      longitud: -75.39778,
    });
    expect(negocio).toEqual({ direccion: "Cra 19 #22-35", latitud: 9.30472, longitud: -75.39778 });
  });

  it("paso 3: guarda la semana, marca el rango del 422 y al terminar entra al panel", async () => {
    perfil.negocios = [nuevo("horarios")];
    const enviados: unknown[] = [];
    servidor.use(
      conPerfil(),
      http.get(`${API}/negocios/7/gestion`, () =>
        ok(gestionDemo({ id_negocio: 7, sucursales: [sedeDemo({ id_negocio: 7, horarios: [] })] })),
      ),
      http.put(`${API}/sucursales/3/horarios`, async ({ request }) => {
        enviados.push(await request.json());
        if (enviados.length === 1) {
          return fallo(422, "Hay rangos de horario que se cruzan", {
            "horarios.1": "Se cruza con el rango de 08:00 a 12:00 del lunes",
          });
        }
        perfil.negocios = [nuevo(null)];
        return ok({ horarios: [], citas_afectadas: [] });
      }),
      http.get(`${API}/negocios/7/suscripcion`, () =>
        ok({
          plan: {},
          suscripcion: null,
          prueba_disponible: true,
          uso: { citas_mes: { usadas: 0, maximo: 30 } },
        }),
      ),
    );
    // Entra al panel con el negocio a medias: se retoma el asistente en el paso de horarios.
    const { router } = renderRuta("/n/7", { usuario: usuarioDemo({ negocios: perfil.negocios }) });
    await waitFor(() => expect(router.state.location.pathname).toBe("/negocios/7/configurar"));
    expect(await screen.findByRole("button", { name: "L–V 8–12 y 14–18" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Terminar" }));
    expect(await screen.findByText("Hay rangos de horario que se cruzan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar rango 14:00–18:00 del lunes" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect((enviados[0] as { horarios: unknown[] }).horarios).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Terminar" }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/n\/7\//));
  });

  it("no deja saltar a un paso posterior al pendiente ni continuar sin rangos", async () => {
    perfil.negocios = [nuevo("sede")];
    servidor.use(
      conPerfil(),
      http.get(`${API}/negocios/7/gestion`, () => ok(gestionDemo({ id_negocio: 7, sucursales: [] }))),
    );
    renderRuta("/negocios/7/configurar?paso=horarios", {
      usuario: usuarioDemo({ negocios: perfil.negocios }),
    });
    expect(await screen.findByLabelText("Nombre de la sede *")).toBeInTheDocument();
  });

  it("sin rangos en la semana no termina", async () => {
    perfil.negocios = [nuevo("horarios")];
    servidor.use(
      conPerfil(),
      http.get(`${API}/negocios/7/gestion`, () =>
        ok(gestionDemo({ id_negocio: 7, sucursales: [sedeDemo({ horarios: [] })] })),
      ),
    );
    renderRuta("/negocios/7/configurar", { usuario: usuarioDemo({ negocios: perfil.negocios }) });
    const user = userEvent.setup();
    for (const nombre of ["lunes", "martes", "miércoles", "jueves", "viernes"]) {
      await user.click(await screen.findByRole("button", { name: `Quitar rango 08:00–12:00 del ${nombre}` }));
      await user.click(screen.getByRole("button", { name: `Quitar rango 14:00–18:00 del ${nombre}` }));
    }
    await user.click(screen.getByRole("button", { name: "Terminar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Agrega al menos un rango");
  });
});

describe("Reanudar la configuración", () => {
  it("A5: el negocio propio a medias dice 'Configuración pendiente' y lleva al asistente", () => {
    renderRuta("/negocios", { usuario: usuarioDemo({ negocios: [negocioDemo(), nuevo("horarios")] }) });
    const tarjeta = screen.getByRole("link", { name: /Patitas Norte/ });
    expect(tarjeta).toHaveTextContent("Configuración pendiente");
    expect(tarjeta).toHaveAttribute("href", "/negocios/7/configurar");
  });

  it("un empleado con configuracion.editar no es redirigido: ve un aviso con enlace a Sedes", async () => {
    const empleado = nuevo("sede", {
      relacion: "empleado",
      rol: { id_rol: 4, nombre: "Administrador", permisos_json: { configuracion: ["ver", "editar"] } },
    });
    renderRuta("/n/7/configuracion", { usuario: usuarioDemo({ negocios: [empleado] }) });
    expect(await screen.findByText(/todavía no tiene sedes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Sedes y horarios" })).toHaveAttribute(
      "href",
      "/n/7/configuracion/sedes",
    );
  });
});
