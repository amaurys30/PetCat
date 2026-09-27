import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearMascota,
  crearNegocio,
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const proximo = (dia) => {
  const fecha = new Date();
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== dia);
  return hoyISO(fecha);
};
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};
const LUNES = proximo(1);
const DOMINGO = proximo(0);

/**
 * Negocio con sucursal de lunes a sábado 08–12 y 14–18, un servicio de 30 min
 * que atienden Ana y Luis, y un cliente con su perro.
 */
const contexto = async ({ servicio: extraServicio = {}, horarios } = {}) => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio, { nombre: "Sede Norte" });
  await crearHorarios(
    sucursal,
    horarios ?? [1, 2, 3, 4, 5, 6].flatMap((d) => [[d, "08:00", "12:00"], [d, "14:00", "18:00"]])
  );
  const ana = await crearEmpleado(negocio, { nombre: "Ana", apellido: "Alba" });
  const luis = await crearEmpleado(negocio, { nombre: "Luis", apellido: "Zapata" });
  const servicio = await crearServicio(negocio, { nombre: "Consulta", precio_base: 60000, ...extraServicio });
  await asignarEmpleados(servicio, [ana, luis]);
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente, { especie: "perro", peso: 12 });
  return { negocio, sucursal, ana, luis, servicio, cliente, mascota, tokenCliente: await tokenDe(cliente) };
};

const query = (ctx, extra = {}) =>
  new URLSearchParams({ id_servicio: ctx.servicio.id_servicio, id_sucursal: ctx.sucursal.id_sucursal, fecha: LUNES, ...extra });

const horariosLibres = (ctx, extra) => api().get(`/citas/horarios-libres?${query(ctx, extra)}`);

const reserva = (ctx, extra = {}) => ({
  id_servicio: ctx.servicio.id_servicio,
  id_sucursal: ctx.sucursal.id_sucursal,
  fecha: LUNES,
  hora_inicio: "09:00",
  id_mascota: ctx.mascota.id_mascota,
  ...extra,
});

const reservar = (ctx, extra, token = ctx.tokenCliente) => api(token).post("/citas").send(reserva(ctx, extra));

/** Cita existente de un empleado en la sucursal del contexto. */
const citaExistente = (ctx, empleado, overrides = {}) =>
  crearCita(ctx.negocio, {
    servicio: ctx.servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    id_empleado: empleado.id_empleado,
    fecha: LUNES,
    estado: "confirmada",
    ...overrides,
  });

describe("GET /citas/horarios-libres", () => {
  it("devuelve la cuadrícula de 15 minutos con los empleados que pueden atender cada horario", async () => {
    const ctx = await contexto();
    const res = await horariosLibres(ctx);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data).toMatchObject({
      fecha: LUNES,
      servicio: { id_servicio: ctx.servicio.id_servicio, nombre: "Consulta", duracion_minutos: 30, precio_actual: 60000 },
      sucursal: { id_sucursal: ctx.sucursal.id_sucursal, nombre: "Sede Norte" },
      motivo_sin_horarios: null,
    });
    expect(data.horarios).toHaveLength(30);
    expect(data.horarios[0]).toEqual({
      hora_inicio: "08:00",
      hora_fin: "08:30",
      empleados: [
        { id_empleado: ctx.ana.id_empleado, nombre: "Ana", apellido: "Alba" },
        { id_empleado: ctx.luis.id_empleado, nombre: "Luis", apellido: "Zapata" },
      ],
    });
    expect(data.horarios.at(-1)).toMatchObject({ hora_inicio: "17:30", hora_fin: "18:00" });
    expect(data.horarios.map((h) => h.hora_inicio)).not.toContain("11:45");
  });

  it("descuenta las citas del empleado contando el margen de su servicio", async () => {
    const ctx = await contexto();
    const conMargen = await crearServicio(ctx.negocio, { margen_minutos: 15 });
    await citaExistente(ctx, ctx.ana, { servicio: conMargen, hora_inicio: "09:00:00", hora_fin: "09:30:00" });

    const { horarios } = (await horariosLibres(ctx)).body.data;
    const empleadosA = (hora) => horarios.find((h) => h.hora_inicio === hora).empleados.map((e) => e.nombre);

    expect(empleadosA("08:30")).toEqual(["Ana", "Luis"]);
    expect(empleadosA("09:00")).toEqual(["Luis"]);
    expect(empleadosA("09:30")).toEqual(["Luis"]);
    expect(empleadosA("09:45")).toEqual(["Ana", "Luis"]);
  });

  it("filtra por empleado; un empleado que no atiende el servicio -> 422", async () => {
    const ctx = await contexto();
    const res = await horariosLibres(ctx, { id_empleado: ctx.luis.id_empleado });
    expect(res.body.data.horarios[0].empleados.map((e) => e.nombre)).toEqual(["Luis"]);

    const otro = await crearEmpleado(ctx.negocio);
    const invalido = await horariosLibres(ctx, { id_empleado: otro.id_empleado });
    expect(invalido.status).toBe(422);
    expect(invalido.body.errors).toEqual({ id_empleado: "Ese empleado no atiende este servicio" });
  });

  it("sin horarios responde 200 con el motivo", async () => {
    const soloMartes = await contexto({ servicio: { dias_disponible: "martes" } });
    expect((await horariosLibres(soloMartes)).body.data).toMatchObject({
      horarios: [],
      motivo_sin_horarios: "El servicio no se ofrece los lunes",
    });

    const conCupo = await contexto({ servicio: { max_citas_dia: 1 } });
    await citaExistente(conCupo, conCupo.ana, { estado: "pendiente" });
    expect((await horariosLibres(conCupo)).body.data.motivo_sin_horarios).toBe("No quedan cupos para este servicio ese día");

    const cerrado = await contexto();
    expect((await horariosLibres(cerrado, { fecha: DOMINGO })).body.data).toMatchObject({
      horarios: [],
      motivo_sin_horarios: "No hay horarios disponibles para esa fecha",
    });
  });

  it("las citas canceladas no ocupan agenda ni cupo", async () => {
    const ctx = await contexto({ servicio: { max_citas_dia: 1 } });
    await citaExistente(ctx, ctx.ana, { estado: "cancelada" });
    const { data } = (await horariosLibres(ctx)).body;
    expect(data.motivo_sin_horarios).toBeNull();
    expect(data.horarios.find((h) => h.hora_inicio === "09:00").empleados).toHaveLength(2);
  });

  it("valida servicio, sucursal y fecha", async () => {
    const ctx = await contexto();
    const oculto = await crearServicio(ctx.negocio, { visible_app: false });
    const ajena = await crearSucursal(await crearNegocio());

    const casos = [
      [{ id_servicio: oculto.id_servicio }, { id_servicio: "El servicio no existe o no está disponible" }],
      [{ id_sucursal: ajena.id_sucursal }, { id_sucursal: "La sucursal no existe o no está activa en este negocio" }],
      [{ fecha: sumarDias(hoyISO(), -1) }, { fecha: "No puede ser una fecha pasada" }],
      [{ fecha: sumarDias(hoyISO(), 61) }, { fecha: `Solo se puede reservar hasta el ${sumarDias(hoyISO(), 60)}` }],
    ];
    for (const [extra, errors] of casos) {
      const res = await horariosLibres(ctx, extra);
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual(errors);
    }
    expect((await api().get("/citas/horarios-libres?id_servicio=1")).status).toBe(422);
  });

  it("servicio sin cita o sin profesionales -> 409", async () => {
    const ctx = await contexto();
    const sinCita = await crearServicio(ctx.negocio, { requiere_cita: false });
    const sinEmpleados = await crearServicio(ctx.negocio);

    const a = await horariosLibres(ctx, { id_servicio: sinCita.id_servicio });
    expect(a.status).toBe(409);
    expect(a.body.message).toBe("Este servicio no requiere cita: se atiende por orden de llegada");
    const b = await horariosLibres(ctx, { id_servicio: sinEmpleados.id_servicio });
    expect(b.body.message).toBe("El servicio no tiene profesionales asignados: no se puede reservar");
  });

  it("hoy: la app exige la antelación mínima; el panel solo que el horario sea futuro", async () => {
    const todoElDia = [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "00:00", "23:59"]);
    const ctx = await contexto({ horarios: todoElDia });
    const ahora = new Date();
    const minuto = ahora.getHours() * 60 + ahora.getMinutes();
    const aMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

    const app = (await horariosLibres(ctx, { fecha: hoyISO() })).body.data.horarios;
    const panel = (
      await api(await tokenDe(ctx.negocio.propietario)).get(
        `/negocios/${ctx.negocio.id_negocio}/citas/horarios-libres?${query(ctx, { fecha: hoyISO() })}`
      )
    ).body.data.horarios;

    if (app.length > 0) expect(aMin(app[0].hora_inicio)).toBeGreaterThanOrEqual(minuto + 60);
    if (panel.length > 0) {
      expect(aMin(panel[0].hora_inicio)).toBeGreaterThanOrEqual(minuto);
      expect(aMin(panel[0].hora_inicio)).toBeLessThan(minuto + 16);
    }
    expect(panel.length).toBeGreaterThanOrEqual(app.length);
  });
});

describe("POST /citas (app)", () => {
  it("crea la cita pendiente, con precio actual y el historial de creación", async () => {
    const ctx = await contexto({ servicio: { en_oferta: true, precio_oferta: 45000 } });
    const res = await reservar(ctx, { hora_inicio: "09:15", id_empleado: ctx.luis.id_empleado, notas_cliente: "Está nervioso" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Cita solicitada: el negocio debe confirmarla");
    expect(res.body.data).toMatchObject({
      fecha: LUNES,
      hora_inicio: "09:15",
      hora_fin: "09:45",
      estado: "pendiente",
      origen: "app_movil",
      prioridad: "normal",
      precio_estimado: 45000,
      notas_cliente: "Está nervioso",
      negocio: { id_negocio: ctx.negocio.id_negocio },
      sucursal: { id_sucursal: ctx.sucursal.id_sucursal, nombre: "Sede Norte" },
      servicio: { id_servicio: ctx.servicio.id_servicio, duracion_minutos: 30 },
      empleado: { id_empleado: ctx.luis.id_empleado, nombre: "Luis" },
      mascota: { id_mascota: ctx.mascota.id_mascota },
      cliente: { id_usuario: ctx.cliente.id_usuario },
    });
    expect(res.body.data).not.toHaveProperty("notas_internas");

    const [historial] = await pool.query(
      "SELECT id_usuario, id_empleado, campo_modificado, valor_anterior, valor_nuevo FROM historial_citas WHERE id_cita = ?",
      [res.body.data.id_cita]
    );
    expect(historial).toEqual([
      { id_usuario: ctx.cliente.id_usuario, id_empleado: null, campo_modificado: "estado", valor_anterior: null, valor_nuevo: "pendiente" },
    ]);
    const [recordatorios] = await pool.query("SELECT 1 FROM recordatorios WHERE id_cita = ?", [res.body.data.id_cita]);
    expect(recordatorios).toHaveLength(0);
  });

  it("sin id_empleado asigna al empleado libre con menos citas ese día (a igualdad, el de menor id)", async () => {
    const ctx = await contexto();
    await citaExistente(ctx, ctx.ana, { hora_inicio: "15:00:00", hora_fin: "15:30:00" });
    const menosCitas = await reservar(ctx);
    expect(menosCitas.body.data.empleado.id_empleado).toBe(ctx.luis.id_empleado);

    const empate = await contexto();
    const res = await reservar(empate);
    expect(res.body.data.empleado.id_empleado).toBe(Math.min(empate.ana.id_empleado, empate.luis.id_empleado));
  });

  it("horario ocupado -> 409; si un empleado está ocupado se asigna el otro", async () => {
    const ctx = await contexto();
    await citaExistente(ctx, ctx.ana, { hora_inicio: "09:00:00", hora_fin: "09:30:00" });

    const conAna = await reservar(ctx, { id_empleado: ctx.ana.id_empleado });
    expect(conAna.status).toBe(409);
    expect(conAna.body.message).toBe("El horario ya no está disponible: elige otro");

    const cualquiera = await reservar(ctx);
    expect(cualquiera.body.data.empleado.id_empleado).toBe(ctx.luis.id_empleado);

    const otraMascota = await crearMascota(ctx.cliente);
    expect((await reservar(ctx, { id_mascota: otraMascota.id_mascota })).status).toBe(409);
  });

  it("valida la mascota: ajena o eliminada 422, fallecida 409, especie o peso no admitidos 422", async () => {
    const ctx = await contexto({ servicio: { tipo_mascota: "perro", peso_max_kg: 10 } });
    const ajena = await crearMascota(await crearUsuario());
    const eliminada = await crearMascota(ctx.cliente, { activo: false });
    const fallecida = await crearMascota(ctx.cliente, { fallecido: true, fecha_fallecimiento: "2026-01-01" });
    const gato = await crearMascota(ctx.cliente, { especie: "gato" });
    const sinPeso = await crearMascota(ctx.cliente, { peso: null });

    for (const m of [ajena, eliminada]) {
      const res = await reservar(ctx, { id_mascota: m.id_mascota });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({ id_mascota: "La mascota no existe o no pertenece al cliente" });
    }
    const muerta = await reservar(ctx, { id_mascota: fallecida.id_mascota });
    expect(muerta.status).toBe(409);
    expect(muerta.body.message).toBe("La mascota está registrada como fallecida: no puede recibir citas");

    expect((await reservar(ctx, { id_mascota: gato.id_mascota })).body.errors).toEqual({
      id_mascota: "El servicio no atiende la especie gato",
    });
    expect((await reservar(ctx)).body.errors).toEqual({ id_mascota: "El servicio es para mascotas de hasta 10 kg" });
    expect((await reservar(ctx, { id_mascota: sinPeso.id_mascota })).status).toBe(201);
  });

  it("la mascota no puede tener dos citas a la misma hora, aunque sean de negocios distintos", async () => {
    const ctx = await contexto();
    const otroNegocio = await crearNegocio();
    await crearCita(otroNegocio, {
      cliente: ctx.cliente,
      mascota: ctx.mascota,
      fecha: LUNES,
      hora_inicio: "09:15:00",
      hora_fin: "09:45:00",
    });
    const res = await reservar(ctx);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("La mascota ya tiene otra cita a esa hora");
  });

  it("hora fuera de la cuadrícula -> 422; día que el servicio no se ofrece -> 409", async () => {
    const ctx = await contexto({ servicio: { dias_disponible: "martes" } });
    const fuera = await reservar(ctx, { hora_inicio: "09:10" });
    expect(fuera.status).toBe(422);
    expect(fuera.body.errors).toEqual({ hora_inicio: "Debe estar en la cuadrícula de 15 minutos (p. ej. :00, :15, :30, :45)" });

    const dia = await reservar(ctx);
    expect(dia.status).toBe(409);
    expect(dia.body.message).toBe("El servicio no se ofrece los lunes");
  });

  it("max_citas_dia por sucursal y día -> 409 al agotarse", async () => {
    const ctx = await contexto({ servicio: { max_citas_dia: 1 } });
    expect((await reservar(ctx)).status).toBe(201);
    const otra = await crearMascota(ctx.cliente);
    const res = await reservar(ctx, { id_mascota: otra.id_mascota, hora_inicio: "10:00" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("No quedan cupos para este servicio ese día");
  });

  it("reservas simultáneas del mismo horario con un solo empleado: una 201 y las demás 409 (no 500)", async () => {
    const ctx = await contexto();
    await pool.query("DELETE FROM empleado_servicios WHERE id_servicio = ? AND id_empleado = ?", [
      ctx.servicio.id_servicio,
      ctx.luis.id_empleado,
    ]);
    const clientes = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const cliente = await crearUsuario();
        return { mascota: await crearMascota(cliente), token: await tokenDe(cliente) };
      })
    );
    const respuestas = await Promise.all(
      clientes.map(({ mascota, token }) => reservar(ctx, { id_mascota: mascota.id_mascota }, token))
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
  });

  it("ve la cita que otra transacción confirmó mientras esperaba el bloqueo del empleado (servicio con cupos)", async () => {
    // Otra reserva (de otro servicio) tiene bloqueado a Ana y crea su cita de las 09:00.
    const ctx = await contexto({ servicio: { max_citas_dia: 5 } });
    await pool.query("DELETE FROM empleado_servicios WHERE id_servicio = ? AND id_empleado = ?", [
      ctx.servicio.id_servicio,
      ctx.luis.id_empleado,
    ]);
    const otroServicio = await crearServicio(ctx.negocio);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("SELECT id_empleado FROM empleados WHERE id_empleado = ? FOR UPDATE", [ctx.ana.id_empleado]);
      const otroCliente = await crearUsuario();
      await conn.query(
        `INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, '09:00:00', '09:30:00', 'confirmada')`,
        [
          ctx.negocio.id_negocio,
          ctx.sucursal.id_sucursal,
          otroCliente.id_usuario,
          (await crearMascota(otroCliente)).id_mascota,
          otroServicio.id_servicio,
          ctx.ana.id_empleado,
          LUNES,
        ]
      );

      const pendiente = reservar(ctx).then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await conn.commit();
      const res = await pendiente;
      expect(res.status).toBe(409);
    } finally {
      conn.release();
    }
  });

  it("sin token -> 401; campos no permitidos -> 422", async () => {
    const ctx = await contexto();
    expect((await api().post("/citas").send(reserva(ctx))).status).toBe(401);
    const res = await reservar(ctx, { estado: "confirmada", id_usuario: 1 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ estado: "Campo no permitido", id_usuario: "Campo no permitido" });
  });
});

describe("POST /negocios/:id_negocio/citas (panel)", () => {
  it("agenda confirmada con origen, notas internas, recordatorio e historial con el empleado que la creó", async () => {
    const ctx = await contexto();
    const usuario = await crearUsuario();
    const recepcionista = await crearEmpleado(ctx.negocio, { usuario, rol: "Recepcionista" });
    const oculto = await crearServicio(ctx.negocio, { visible_app: false });
    await asignarEmpleados(oculto, [ctx.ana]);

    const res = await api(await tokenDe(usuario))
      .post(`/negocios/${ctx.negocio.id_negocio}/citas`)
      .send({
        ...reserva(ctx, { id_servicio: oculto.id_servicio }),
        id_usuario: ctx.cliente.id_usuario,
        origen: "telefono",
        prioridad: "alta",
        notas_internas: "Llamó a las 8",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Cita agendada y confirmada");
    expect(res.body.data).toMatchObject({
      estado: "confirmada",
      origen: "telefono",
      prioridad: "alta",
      notas_internas: "Llamó a las 8",
      empleado: { id_empleado: ctx.ana.id_empleado },
    });
    const id_cita = res.body.data.id_cita;
    const [[recordatorio]] = await pool.query(
      "SELECT tipo, canal, fecha_programada FROM recordatorios WHERE id_cita = ?",
      [id_cita]
    );
    expect(recordatorio).toEqual({ tipo: "cita_recordatorio", canal: "push,whatsapp", fecha_programada: `${LUNES} 07:00:00` });
    const [[historial]] = await pool.query("SELECT id_usuario, id_empleado, valor_nuevo FROM historial_citas WHERE id_cita = ?", [
      id_cita,
    ]);
    expect(historial).toEqual({ id_usuario: usuario.id_usuario, id_empleado: recepcionista.id_empleado, valor_nuevo: "confirmada" });
  });

  it("la mascota debe ser del cliente indicado; cliente inexistente -> 422", async () => {
    const ctx = await contexto();
    const token = await tokenDe(ctx.negocio.propietario);
    const url = `/negocios/${ctx.negocio.id_negocio}/citas`;

    const otro = await crearUsuario();
    const ajena = await api(token).post(url).send({ ...reserva(ctx), id_usuario: otro.id_usuario });
    expect(ajena.status).toBe(422);
    expect(ajena.body.errors).toHaveProperty("id_mascota");

    const nadie = await api(token).post(url).send({ ...reserva(ctx), id_usuario: 999999999 });
    expect(nadie.body.errors).toEqual({ id_usuario: "El cliente no existe" });
  });

  it("un servicio de otro negocio -> 422; sin citas.crear -> 403", async () => {
    const ctx = await contexto();
    const otro = await contexto();
    const token = await tokenDe(ctx.negocio.propietario);
    const res = await api(token)
      .post(`/negocios/${ctx.negocio.id_negocio}/citas`)
      .send({ ...reserva(otro), id_usuario: otro.cliente.id_usuario });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ id_servicio: "El servicio no existe o no está disponible" });

    const usuario = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, { citas: ["ver"] })).id_rol });
    const sinPermiso = await api(await tokenDe(usuario))
      .post(`/negocios/${ctx.negocio.id_negocio}/citas`)
      .send({ ...reserva(ctx), id_usuario: ctx.cliente.id_usuario });
    expect(sinPermiso.status).toBe(403);
  });
});
