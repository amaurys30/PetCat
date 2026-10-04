import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Empleado } from "@/api/empleados";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { empleadoDemo, rolesDemo } from "@/test/equipo";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const pagina = (data: Empleado[]) => ({
  success: true,
  message: "OK",
  data,
  meta: { total: data.length, page: 1, limit: 20, totalPages: 1, hasNext: false },
});

const suscripcion = (usadas: number, maximo: number) =>
  http.get(`${API}/negocios/1/suscripcion`, () =>
    ok({
      plan: { id_plan: 1, nombre: "Gratuito" },
      suscripcion: null,
      prueba_disponible: true,
      uso: { empleados: { usadas, maximo }, sucursales: { usadas: 1, maximo: 1 } },
    }),
  );

const propietaria = empleadoDemo({
  id_empleado: 5,
  id_usuario: 2,
  nombre: "Laura",
  apellido: "Gómez",
  email: "propietario@petcat.test",
  es_propietario: true,
  tiene_cuenta: true,
  invitacion: null,
  rol: { id_rol: 1, nombre: "Administrador" },
  servicios: [{ id_servicio: 1, nombre: "Consulta general" }],
});
const carlos = empleadoDemo({
  tiene_cuenta: true,
  id_usuario: 3,
  invitacion: null,
  servicios: [
    { id_servicio: 1, nombre: "Consulta general" },
    { id_servicio: 2, nombre: "Vacuna antirrábica" },
  ],
});
const paula = empleadoDemo({
  id_empleado: 2,
  nombre: "Paula",
  apellido: "Rojas",
  email: "paula@petcat.test",
  invitacion_pendiente: true,
  invitacion: { expiracion: "2099-01-03 10:00:00", envios_restantes_24h: 3, libre_desde: null },
});
const andres = empleadoDemo({ id_empleado: 3, nombre: "Andrés", apellido: "Vega", email: "andres@petcat.test" });
const mariana = empleadoDemo({
  id_empleado: 4,
  nombre: "Mariana",
  apellido: "Ríos",
  activo: false,
  invitacion: null,
  rol: { id_rol: 3, nombre: "Recepcionista" },
});

const base = ({ empleados = [propietaria, carlos, paula, andres, mariana], usadas = 3, maximo = 4 } = {}) => [
  http.get(`${API}/negocios/1/empleados`, () => HttpResponse.json(pagina(empleados))),
  http.get(`${API}/negocios/1/roles`, () => ok(rolesDemo)),
  http.get(`${API}/negocios/1/servicios`, () =>
    HttpResponse.json({
      success: true,
      message: "OK",
      data: [
        { id_servicio: 1, nombre: "Consulta general" },
        { id_servicio: 2, nombre: "Vacuna antirrábica" },
      ],
      meta: { total: 2, page: 1, limit: 100, totalPages: 1, hasNext: false },
    }),
  ),
  suscripcion(usadas, maximo),
];

const fila = (nombre: string) => screen.getByRole("row", { name: new RegExp(nombre) });

beforeEach(() => __reiniciarSesionParaPruebas());

describe("D3 · Equipo", () => {
  it("lista miembros con rol, cuenta, servicios, estado y el uso del plan", async () => {
    servidor.use(...base());
    renderRuta("/n/1/equipo", { usuario: usuarioDemo({ negocios: [negocioDemo({ id_empleado: 5 })] }) });
    await screen.findByText("Carlos Martínez");
    expect(within(fila("Laura Gómez")).getByText("Propietario")).toBeInTheDocument();
    expect(within(fila("Carlos Martínez")).getByText("Vinculada")).toBeInTheDocument();
    expect(within(fila("Carlos Martínez")).getByText("Consulta general, Vacuna antirrábica")).toBeInTheDocument();
    expect(within(fila("Paula Rojas")).getByText(/Invitación pendiente · vence en/)).toBeInTheDocument();
    expect(within(fila("Paula Rojas")).getByRole("button", { name: "Reenviar (3 de 4)" })).toBeEnabled();
    expect(within(fila("Andrés Vega")).getByText("Sin invitar")).toBeInTheDocument();
    expect(within(fila("Andrés Vega")).getByRole("button", { name: "Enviar invitación" })).toBeInTheDocument();
    expect(within(fila("Mariana Ríos")).getByText("Inactivo")).toBeInTheDocument();
    expect(within(fila("Mariana Ríos")).getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
    expect(
      await screen.findByText(/Plan Gratuito: 3 de 4 empleados\. El propietario no cuenta para el límite\./),
    ).toBeInTheDocument();
    // Ya está registrada como profesional: no se ofrece "Agregarme".
    expect(screen.queryByRole("button", { name: "Agregarme como profesional" })).not.toBeInTheDocument();
  });

  it("en el límite del plan, agregar y reactivar abren el diálogo de Pro sin llamar a la API", async () => {
    let reactivado = false;
    servidor.use(
      ...base({ usadas: 3, maximo: 3 }),
      http.patch(`${API}/empleados/4/reactivar`, () => {
        reactivado = true;
        return ok(mariana);
      }),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(await screen.findByText(/Para sumar más, prueba Pro 14 días/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar miembro" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Tu plan Gratuito permite 3 empleados activos (el propietario no cuenta)");
    await user.keyboard("{Escape}");
    await user.click(within(fila("Mariana Ríos")).getByRole("button", { name: "Reactivar" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Alcanzaste el límite de tu plan");
    expect(reactivado).toBe(false);
  });

  it("crea un miembro con sus servicios y le envía la invitación", async () => {
    let creado: unknown;
    let invitado = false;
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/empleados`, async ({ request }) => {
        creado = await request.json();
        return ok(empleadoDemo({ id_empleado: 7, nombre: "Luis", apellido: "Suárez", email: "luis@petcat.test" }), 201);
      }),
      http.post(`${API}/empleados/7/invitacion`, () => {
        invitado = true;
        return ok({ id_invitacion: 1, email: "luis@petcat.test", expiracion: "2099-01-01 10:00:00", envios_restantes_24h: 3 }, 201);
      }),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar miembro" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Nombre *"), "Luis");
    await user.type(within(dialogo).getByLabelText("Apellido *"), "Suárez");
    await user.type(within(dialogo).getByLabelText("Correo (para la invitación)"), "luis@petcat.test");
    await user.type(within(dialogo).getByLabelText("Documento"), "CC 1102345678");
    // Por defecto se sugiere un rol que no sea Administrador; se elige Veterinario.
    await user.click(within(dialogo).getByRole("radio", { name: /Veterinario/ }));
    await user.click(within(dialogo).getByRole("button", { name: "Consulta general" }));
    await user.click(within(dialogo).getByRole("button", { name: "Guardar y enviar invitación" }));

    expect(await screen.findByText(/Luis Suárez quedó en el equipo\. Invitación enviada a luis@petcat\.test/)).toBeInTheDocument();
    expect(creado).toEqual({
      nombre: "Luis",
      apellido: "Suárez",
      email: "luis@petcat.test",
      documento: "CC 1102345678",
      id_rol: 2,
      servicios: [1],
    });
    expect(invitado).toBe(true);
  });

  it("si la invitación falla, el miembro queda creado y el aviso lo dice", async () => {
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/empleados`, () => ok(empleadoDemo({ id_empleado: 7, nombre: "Luis", apellido: "Suárez" }), 201)),
      http.post(`${API}/empleados/7/invitacion`, () =>
        fallo(503, "No se pudo enviar el correo de invitación. Intenta de nuevo en unos minutos"),
      ),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar miembro" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Nombre *"), "Luis");
    await user.type(within(dialogo).getByLabelText("Apellido *"), "Suárez");
    await user.type(within(dialogo).getByLabelText("Correo (para la invitación)"), "luis@petcat.test");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar y enviar invitación" }));
    expect(
      await screen.findByText(/Luis Suárez quedó en el equipo, pero la invitación no se envió \(No se pudo enviar el correo/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el 409 de un correo de un miembro inactivo ofrece reactivarlo", async () => {
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/empleados`, () =>
        fallo(
          409,
          "Ese email pertenece a un empleado inactivo del negocio (id_empleado 4): puedes reactivarlo en lugar de crear otro",
          { email: "Pertenece a un empleado inactivo que se puede reactivar: PATCH /empleados/4/reactivar" },
        ),
      ),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar miembro" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Nombre *"), "Mariana");
    await user.type(within(dialogo).getByLabelText("Apellido *"), "Ríos");
    await user.type(within(dialogo).getByLabelText("Correo (para la invitación)"), "mariana@petcat.test");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar y enviar invitación" }));
    expect(await within(dialogo).findByText(/Ese correo es de un miembro inactivo/)).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Reactivarlo" })).toBeInTheDocument();
  });

  it("reenvía la invitación y dice cuántos envíos quedan", async () => {
    servidor.use(
      ...base(),
      http.post(`${API}/empleados/2/invitacion/reenviar`, () =>
        ok({ id_invitacion: 9, email: "paula@petcat.test", expiracion: "2099-01-04 10:00:00", envios_restantes_24h: 2 }, 201),
      ),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await within(await screen.findByRole("row", { name: /Paula Rojas/ })).findByRole("button", { name: "Reenviar (3 de 4)" }));
    expect(await screen.findByText(/Invitación reenviada a paula@petcat\.test\. Puedes enviarle 2 más en 24 horas\./)).toBeInTheDocument();
  });

  it("sin envíos disponibles el botón queda deshabilitado con la hora en que se libera", async () => {
    const agotada = empleadoDemo({
      ...paula,
      invitacion: { expiracion: "2099-01-03 10:00:00", envios_restantes_24h: 0, libre_desde: "2099-01-01 09:30" },
    });
    servidor.use(...base({ empleados: [agotada] }));
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    expect(await screen.findByRole("button", { name: "Reenviar (0 de 4)" })).toBeDisabled();
  });

  it("desactivar muestra las citas que están fuera de la disponibilidad", async () => {
    servidor.use(
      ...base(),
      http.delete(`${API}/empleados/1`, () =>
        ok({
          empleado: { ...carlos, activo: false },
          citas_afectadas: [
            {
              id_cita: 40,
              fecha: "2099-10-05",
              hora_inicio: "15:00:00",
              hora_fin: "15:30:00",
              estado: "confirmada",
              sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
              servicio: { id_servicio: 1, nombre: "Consulta general" },
              mascota: { id_mascota: 2, nombre: "Rocky" },
              cliente: { id_usuario: 8, nombre: "Sofía", apellido: "Gómez", telefono: "3005556677" },
            },
          ],
        }),
      ),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Más acciones para Carlos Martínez" }));
    await user.click(await screen.findByRole("menuitem", { name: "Desactivar" }));
    const confirmar = await screen.findByRole("dialog");
    expect(confirmar).toHaveTextContent("¿Desactivar a Carlos Martínez?");
    await user.click(within(confirmar).getByRole("button", { name: "Desactivar" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "Carlos Martínez quedó inactivo. 1 cita está fuera de la disponibilidad",
      ),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Rocky");
  });

  it("agregarme como profesional: solo el propietario sin registro, y luego ofrece su disponibilidad", async () => {
    let cuerpo: unknown;
    servidor.use(
      ...base({ empleados: [carlos] }),
      http.post(`${API}/negocios/1/empleados/yo`, async ({ request }) => {
        cuerpo = await request.json();
        return HttpResponse.json(
          { success: true, message: "Te registraste como empleado del negocio", data: { ...propietaria, id_empleado: 12 } },
          { status: 201 },
        );
      }),
      http.get(`${API}/auth/me`, () => ok(usuarioDemo({ negocios: [negocioDemo({ id_empleado: 12 })] }))),
    );
    renderRuta("/n/1/equipo/miembros", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregarme como profesional" }));
    const dialogo = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialogo).getByLabelText("Rol")).toHaveValue("1"));
    await user.type(within(dialogo).getByLabelText("Especialidad"), "Cirugía");
    await user.click(within(dialogo).getByRole("button", { name: "Agregarme" }));
    expect(await within(dialogo).findByText("Ya eres parte del equipo")).toBeInTheDocument();
    expect(within(dialogo).getByRole("link", { name: "Configurar mi disponibilidad" })).toHaveAttribute(
      "href",
      "/n/1/equipo/12/disponibilidad",
    );
    expect(cuerpo).toEqual({ id_rol: 1, especialidad: "Cirugía" });
  });

  it("escalada: un empleado no puede asignar roles con más permisos ni tocar a quien tiene más", async () => {
    const coordinador = usuarioDemo({
      id_usuario: 20,
      negocios: [
        negocioDemo({
          relacion: "empleado",
          id_empleado: 6,
          rol: { id_rol: 9, nombre: "Coordinador", permisos_json: rolesDemo[3]!.permisos_json },
        }),
      ],
    });
    const yo = empleadoDemo({
      id_empleado: 6,
      id_usuario: 20,
      nombre: "Diana",
      apellido: "Coordinadora",
      tiene_cuenta: true,
      invitacion: null,
      rol: { id_rol: 9, nombre: "Coordinador" },
    });
    servidor.use(...base({ empleados: [propietaria, yo, andres] }));
    renderRuta("/n/1/equipo/miembros", { usuario: coordinador });
    const user = userEvent.setup();

    // La propietaria tiene un rol con más permisos: no se puede editar ni desactivar.
    await user.click(await screen.findByRole("button", { name: "Más acciones para Laura Gómez" }));
    expect(await screen.findByRole("menuitem", { name: /Editar/ })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: /Desactivar/ })).toHaveTextContent(
      "Tiene permisos que tu rol no tiene",
    );
    await user.keyboard("{Escape}");

    // A sí misma no se puede desactivar.
    await user.click(screen.getByRole("button", { name: "Más acciones para Diana Coordinadora" }));
    expect(await screen.findByRole("menuitem", { name: /Desactivar/ })).toHaveTextContent(
      "No puedes desactivarte a ti mismo",
    );
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Agregar miembro" }));
    const dialogo = await screen.findByRole("dialog");
    const admin = await within(dialogo).findByRole("radio", { name: /Administrador/ });
    expect(admin).toHaveAttribute("aria-disabled", "true");
    expect(admin).toHaveTextContent("Tu rol no tiene todos los permisos de este rol");
    expect(within(dialogo).getByRole("radio", { name: /Recepcionista/ })).not.toHaveAttribute("aria-disabled");
    expect(dialogo).toHaveTextContent("Solo puedes asignar roles con permisos que tu rol tenga.");
    // Sin servicios.ver no se muestran los servicios.
    expect(within(dialogo).queryByText("Servicios que atiende")).not.toBeInTheDocument();
  });

  it("sin empleados.ver: sin permiso", async () => {
    const vet = usuarioDemo({
      negocios: [
        negocioDemo({ relacion: "empleado", id_empleado: 1, rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver"] } } }),
      ],
    });
    renderRuta("/n/1/equipo/miembros", { usuario: vet });
    expect(await screen.findByText("No tienes permiso para ver esta sección")).toBeInTheDocument();
  });
});
