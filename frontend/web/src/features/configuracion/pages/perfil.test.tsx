import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import type { NegocioGestion } from "@/api/negocios";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

const suscripcion = http.get(`${API}/negocios/1/suscripcion`, () =>
  ok({
    plan: { id_plan: 1, nombre: "Gratuito" },
    suscripcion: { estado: "activa" },
    prueba_disponible: true,
    uso: {
      sucursales: { usadas: 1, maximo: 1 },
      empleados: { usadas: 3, maximo: 3 },
      citas_mes: { usadas: 26, maximo: 30 },
    },
  }),
);

const conGestion = (datos: NegocioGestion = gestionDemo()) => [
  http.get(`${API}/negocios/1/gestion`, () => ok(datos)),
  http.get(`${API}/auth/me`, () => ok(usuarioDemo())),
  suscripcion,
];

beforeEach(() => __reiniciarSesionParaPruebas());

describe("E1 · Perfil del negocio", () => {
  it("guarda solo lo que cambió y completa https:// en el sitio web", async () => {
    let cuerpo: unknown;
    servidor.use(
      ...conGestion(),
      http.patch(`${API}/negocios/1`, async ({ request }) => {
        cuerpo = await request.json();
        return ok(gestionDemo());
      }),
    );
    renderRuta("/n/1/configuracion/perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const web = await screen.findByLabelText("Sitio web");
    await user.type(web, "@patitas");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/Escribe una dirección web/)).toBeInTheDocument();

    await user.clear(web);
    await user.type(web, "patitas.co");
    await user.clear(screen.getByLabelText("Razón social"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(cuerpo).toEqual({ sitio_web: "https://patitas.co", razon_social: null }));
  });

  it("'Así te ven en la app' sigue el nombre que se escribe", async () => {
    servidor.use(...conGestion());
    renderRuta("/n/1/configuracion/perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const nombre = await screen.findByLabelText("Nombre *");
    await user.clear(nombre);
    await user.type(nombre, "Patitas Express");
    const vista = screen.getByRole("heading", { name: "Así te ven en la app" }).parentElement!;
    expect(within(vista).getByText("Patitas Express")).toBeInTheDocument();
    expect(within(vista).getByText(/4.7 · 38 reseñas/)).toBeInTheDocument();
  });

  it("la confirmación automática se aplica al instante y vuelve atrás si la API falla", async () => {
    const cuerpos: unknown[] = [];
    servidor.use(
      ...conGestion(),
      http.patch(`${API}/negocios/1`, async ({ request }) => {
        cuerpos.push(await request.json());
        return cuerpos.length === 1 ? ok(gestionDemo()) : fallo(500, "Error del servidor");
      }),
    );
    renderRuta("/n/1/configuracion/perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const interruptor = await screen.findByRole("switch", { name: /Confirmar automáticamente/ });
    expect(screen.getByText(/tienes hasta 24 h \(o hasta 1 h antes de la cita\)/)).toBeInTheDocument();

    await user.click(interruptor);
    expect(interruptor).toBeChecked();
    await waitFor(() => expect(cuerpos).toEqual([{ confirmacion_automatica: true }]));

    await user.click(interruptor);
    await waitFor(() => expect(interruptor).toBeChecked());
    expect(cuerpos).toHaveLength(2);
  });

  it("avisa las citas perdidas por no confirmar en los últimos 30 días", async () => {
    servidor.use(
      ...conGestion(
        gestionDemo({
          reglas_confirmacion: {
            confirmacion_automatica: false,
            plazo_confirmacion_h: 24,
            confirmacion_antes_inicio_min: 60,
            citas_perdidas: {
              dias: 30,
              total: 4,
              sugerencia: {
                codigo: "activar_confirmacion_automatica",
                mensaje: "Actívala y no pierdas más.",
              },
            },
          },
        }),
      ),
    );
    renderRuta("/n/1/configuracion/perfil", { usuario: usuarioDemo() });
    expect(
      await screen.findByText(/En los últimos 30 días perdiste 4 citas por no confirmarlas a tiempo/),
    ).toBeInTheDocument();
  });

  it("logo: valida el tamaño antes de subir y sube con multipart", async () => {
    let tipo: string | null = null;
    let cuerpo = "";
    servidor.use(
      ...conGestion(),
      http.put(`${API}/negocios/1/logo`, async ({ request }) => {
        // request.formData() no entiende el multipart que arma jsdom: se revisa el cuerpo crudo.
        tipo = request.headers.get("content-type");
        cuerpo = await request.text();
        return ok(gestionDemo({ logo_url: "https://img/logo.png" }));
      }),
    );
    renderRuta("/n/1/configuracion/perfil", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const archivo = await screen.findByLabelText("Archivo de logo");

    const grande = new File([new Uint8Array(6 * 1024 * 1024)], "logo.png", { type: "image/png" });
    await user.upload(archivo, grande);
    expect(await screen.findByText("La imagen pesa más de 5 MB.")).toBeInTheDocument();
    expect(tipo).toBeNull();

    await user.upload(archivo, new File(["png"], "logo.png", { type: "image/png" }));
    await waitFor(() => expect(tipo).toMatch(/^multipart\/form-data/));
    expect(cuerpo).toContain('name="logo"; filename="logo.png"');
  });

  it("con configuracion.ver y sin editar: solo lectura", async () => {
    servidor.use(...conGestion());
    renderRuta("/n/1/configuracion/perfil", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 5, nombre: "Recepción", permisos_json: { configuracion: ["ver"] } },
          }),
        ],
      }),
    });
    expect(await screen.findByLabelText("Nombre *")).toBeDisabled();
    expect(screen.getByRole("switch", { name: /Confirmar automáticamente/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Cambiar logo|Subir logo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });
});

describe("E0 · Resumen del negocio", () => {
  it("muestra el perfil, las sedes con horario agrupado, el plan, el equipo y las reglas", async () => {
    const semana = [1, 2, 3, 4, 5].flatMap((d) => [
      { dia_semana: d, hora_apertura: "08:00", hora_cierre: "12:00" },
      { dia_semana: d, hora_apertura: "14:00", hora_cierre: "18:00" },
    ]);
    servidor.use(
      ...conGestion(gestionDemo({ sucursales: [sedeDemo({ horarios: semana })] })),
      http.get(`${API}/negocios/1/empleados`, () =>
        HttpResponseConMeta([
          empleado({ id_empleado: 1, nombre: "Carlos", apellido: "Martínez", tiene_cuenta: true }),
          empleado({ id_empleado: 2, nombre: "Paula", apellido: "Rojas", invitacion_pendiente: true }),
          empleado({ id_empleado: 3, nombre: "Andrés", apellido: "Vega" }),
        ]),
      ),
    );
    renderRuta("/n/1/configuracion", { usuario: usuarioDemo() });
    expect(await screen.findByRole("heading", { name: "Clínica Veterinaria Patitas" })).toBeInTheDocument();
    expect(screen.getByText("900123456-7 · Patitas S.A.S.")).toBeInTheDocument();
    expect(screen.getByText("Lunes a viernes")).toBeInTheDocument();
    expect(screen.getByText("08:00–12:00 · 14:00–18:00")).toBeInTheDocument();
    expect(screen.getByText("Sábado y domingo")).toBeInTheDocument();
    expect(await screen.findByText("26 de 30")).toBeInTheDocument();
    expect(screen.getByText("3 de 3")).toBeInTheDocument();
    expect(await screen.findByText("Invitación pendiente")).toBeInTheDocument();
    expect(screen.getByText("Sin invitar")).toBeInTheDocument();
    expect(screen.getByText("Manual · plazo de 24 h")).toBeInTheDocument();
  });
});

const empleado = (cambios: Record<string, unknown>) => ({
  id_negocio: 1,
  id_usuario: null,
  email: null,
  telefono: null,
  documento: null,
  especialidad: null,
  titulo_profesional: null,
  registro_profesional: null,
  foto_url: null,
  foto_miniatura_url: null,
  notas: null,
  activo: true,
  fecha_vinculacion: "2026-09-01",
  fecha_retiro: null,
  fecha_creacion: "2026-09-01 10:00:00",
  fecha_actualizacion: "2026-09-01 10:00:00",
  tiene_cuenta: false,
  invitacion_pendiente: false,
  rol: { id_rol: 2, nombre: "Veterinario" },
  ...cambios,
});

const HttpResponseConMeta = (data: unknown[]) =>
  Response.json({
    success: true,
    message: "OK",
    data,
    meta: { total: data.length, page: 1, limit: 3, totalPages: 1, hasNext: false },
  });
