import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Disponibilidad } from "@/api/disponibilidad";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { hoyISO } from "@/lib/format";
import { empleadoDemo } from "@/test/equipo";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, http, ok, servidor } from "@/test/servidor";

const norte = sedeDemo({ id_sucursal: 5, nombre: "Sede Norte", es_principal: false, horarios: [] });

const citaAfectada = (id: number, mascota: string) => ({
  id_cita: id,
  fecha: "2099-10-05",
  hora_inicio: "15:30:00",
  hora_fin: "16:00:00",
  estado: "confirmada",
  sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
  servicio: { id_servicio: 1, nombre: "Consulta general" },
  mascota: { id_mascota: id, nombre: mascota },
  cliente: { id_usuario: 8, nombre: "Laura", apellido: "Gómez", telefono: null },
});

const base = (disponibilidad: Partial<Disponibilidad> = {}) => [
  http.get(`${API}/empleados/1`, () => ok(empleadoDemo({ rol: { id_rol: 2, nombre: "Veterinario", permisos_json: {} } }))),
  http.get(`${API}/empleados/1/disponibilidad`, () =>
    ok({ horario_semanal: [], sigue_horario_sucursal: true, excepciones: [], ...disponibilidad }),
  ),
  http.get(`${API}/empleados/1/disponibilidad-efectiva`, ({ request }) =>
    ok({
      fecha: new URL(request.url).searchParams.get("fecha"),
      dia_semana: 1,
      sigue_horario_sucursal: true,
      sucursales: [
        { id_sucursal: 3, nombre: "Sede Centro", rangos: [{ hora_inicio: "08:00", hora_fin: "12:00" }] },
        { id_sucursal: 5, nombre: "Sede Norte", rangos: [] },
      ],
    }),
  ),
  http.get(`${API}/negocios/1/gestion`, () => ok(gestionDemo({ sucursales: [sedeDemo(), norte] }))),
  http.get(`${API}/negocios/1/suscripcion`, () =>
    ok({ plan: { id_plan: 1, nombre: "Gratuito" }, suscripcion: null, prueba_disponible: true, uso: {} }),
  ),
];

beforeEach(() => __reiniciarSesionParaPruebas());

describe("D5 · Disponibilidad del profesional", () => {
  it("sin horario propio parte del de la sede, guarda la semana y deja el aviso de citas fuera", async () => {
    let enviado: unknown;
    servidor.use(
      ...base(),
      http.put(`${API}/empleados/1/horario-semanal`, async ({ request }) => {
        enviado = await request.json();
        return ok({ horario_semanal: [], citas_afectadas: [citaAfectada(40, "Rocky"), citaAfectada(41, "Kira")] });
      }),
    );
    renderRuta("/n/1/equipo/1/disponibilidad", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(await screen.findByRole("heading", { name: "Carlos Martínez" })).toBeInTheDocument();
    expect(screen.getByText(/Sin horario propio: el profesional sigue el horario de la sede\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar semana" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Partir del horario de Sede Centro" }));
    // Con varias sedes, cada rango dice de cuál es.
    expect(screen.getByRole("button", { name: "Editar rango 14:00–18:00 en Centro del lunes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar rango 14:00–18:00 del lunes" }));
    await user.click(screen.getByRole("button", { name: "Guardar semana" }));

    const aviso = await screen.findByText("2 citas están fuera de la disponibilidad", { selector: "p" });
    expect(aviso.closest("[role=status]")).toHaveTextContent("Rocky");
    expect(enviado).toEqual({ horarios: [{ dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: 3 }] });

    await user.click(screen.getByRole("button", { name: "Ver detalle y copiar" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Horario guardado. 2 citas están fuera de la disponibilidad",
    );
  });

  it("los rangos que se cruzan, aunque sean de otra sede, se marcan antes de enviar", async () => {
    servidor.use(
      ...base({
        horario_semanal: [
          { id_disponibilidad: 1, dia_semana: 2, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: 3 },
        ],
        sigue_horario_sucursal: false,
      }),
    );
    renderRuta("/n/1/equipo/1/disponibilidad", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar rango 08:00–12:00 en Centro del martes" }));
    const desde = await screen.findByLabelText("Desde");
    await user.selectOptions(desde, "10:00");
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await user.click(screen.getByRole("button", { name: "Agregar rango al martes" }));
    // El nuevo (12:00–16:00, misma sede) no se cruza; se cambia a 11:00 para que sí.
    await user.click(screen.getByRole("button", { name: "Editar rango 13:00–17:00 en Centro del martes" }));
    await user.selectOptions(await screen.findByLabelText("Desde"), "11:00");
    await user.selectOptions(screen.getByLabelText("Sede"), "5");
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await user.click(screen.getByRole("button", { name: "Guardar semana" }));
    expect(await screen.findByText("Corrige los rangos marcados.")).toBeInTheDocument();
    expect(screen.getByText(/Se cruza con 11:00–17:00/)).toBeInTheDocument();
  });

  it("D6: registra un bloqueo con horas y muestra las citas fuera de la disponibilidad", async () => {
    let enviado: unknown;
    servidor.use(
      ...base(),
      http.post(`${API}/empleados/1/disponibilidad`, async ({ request }) => {
        enviado = await request.json();
        return ok(
          {
            disponibilidad: {
              id_disponibilidad: 20,
              id_empleado: 1,
              tipo: "bloqueo",
              fecha_especifica: hoyISO(),
              fecha_fin: null,
              hora_inicio: "14:00",
              hora_fin: "18:00",
              id_sucursal: null,
              motivo: "Cita médica personal",
            },
            citas_afectadas: [citaAfectada(40, "Rocky")],
          },
          201,
        );
      }),
    );
    renderRuta("/n/1/equipo/1/disponibilidad", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "+ Bloqueo" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Nueva excepción · Carlos Martínez");
    expect(within(dialogo).getByRole("switch", { name: "Todo el día" })).not.toBeChecked();
    await user.selectOptions(within(dialogo).getByLabelText("Hora de inicio *"), "14:00");
    await user.selectOptions(within(dialogo).getByLabelText("Hora de fin *"), "18:00");
    await user.type(within(dialogo).getByLabelText("Motivo"), "Cita médica personal");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar bloqueo" }));

    expect(await screen.findByText("1 cita está fuera de la disponibilidad", { selector: "p" })).toBeInTheDocument();
    expect(enviado).toEqual({
      tipo: "bloqueo",
      fecha_especifica: hoyISO(),
      motivo: "Cita médica personal",
      hora_inicio: "14:00",
      hora_fin: "18:00",
    });
  });

  it("D6: vacaciones validan el período y el evento especial exige la sede", async () => {
    servidor.use(...base());
    renderRuta("/n/1/equipo/1/disponibilidad", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "+ Vacaciones" }));
    let dialogo = await screen.findByRole("dialog");
    const hasta = within(dialogo).getByLabelText("Hasta");
    await user.type(hasta, "2000-01-01");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar vacaciones" }));
    expect(await within(dialogo).findByText("No puede ser anterior al primer día")).toBeInTheDocument();

    await user.click(within(dialogo).getByRole("tab", { name: "Evento especial" }));
    dialogo = screen.getByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar evento especial" }));
    expect(await within(dialogo).findByText("Elige la sede", { selector: "p" })).toBeInTheDocument();
  });

  it("lista las excepciones y la disponibilidad efectiva del día con los bloqueos", async () => {
    servidor.use(
      ...base({
        excepciones: [
          {
            id_disponibilidad: 11,
            id_empleado: 1,
            tipo: "bloqueo",
            fecha_especifica: hoyISO(),
            fecha_fin: null,
            hora_inicio: "14:00",
            hora_fin: "18:00",
            id_sucursal: null,
            motivo: "Capacitación",
          },
        ],
      }),
    );
    renderRuta("/n/1/equipo/1/disponibilidad", { usuario: usuarioDemo() });
    const item = (await screen.findByText("Capacitación")).closest("li")!;
    expect(item).toHaveTextContent("14:00–18:00");
    expect(item).toHaveTextContent("Bloqueo");
    expect(await screen.findByText("08:00–12:00")).toBeInTheDocument();
    expect(screen.getByText("14:00–18:00 bloqueado: capacitación")).toBeInTheDocument();
    expect(screen.getByText("No atiende este día")).toBeInTheDocument();
  });

  it("el propio veterinario ve su disponibilidad sin poder editarla", async () => {
    const vet = usuarioDemo({
      nombre: "Carlos",
      apellido: "Martínez",
      negocios: [
        negocioDemo({ relacion: "empleado", id_empleado: 1, rol: { id_rol: 2, nombre: "Veterinario", permisos_json: {} } }),
      ],
    });
    servidor.use(
      ...base(),
      http.get(`${API}/negocios/1`, () => ok({ sucursales: [{ ...sedeDemo(), horarios: [] }] })),
    );
    renderRuta("/n/1/equipo/1/disponibilidad", { usuario: vet });
    expect(await screen.findByRole("heading", { name: "Carlos Martínez" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Guardar semana" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "+ Bloqueo" })).not.toBeInTheDocument();
  });
});
