import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearMascota,
  crearNegocio,
  crearRol,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

/** Próxima fecha (desde mañana) que cae en ese día de la semana (0 = domingo). */
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

const LUNES = 1;
const DOMINGO = 0;

/**
 * Negocio con una sucursal de horario partido (lunes a sábado 08–12 y 14–18),
 * un empleado y el token del propietario.
 */
const contexto = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio, { nombre: "Sede Centro" });
  await crearHorarios(
    sucursal,
    [1, 2, 3, 4, 5, 6].flatMap((d) => [
      [d, "08:00", "12:00"],
      [d, "14:00", "18:00"],
    ])
  );
  const empleado = await crearEmpleado(negocio);
  return { negocio, sucursal, empleado, token: await tokenDe(negocio.propietario) };
};

/** Cita del empleado en la sucursal (por defecto el próximo lunes de 09:00 a 09:30, confirmada). */
const citaDe = async ({ negocio, sucursal, empleado }, overrides = {}) => {
  const cliente = await crearUsuario({ nombre: "Laura", apellido: "Díaz", telefono: "3005556677" });
  const mascota = await crearMascota(cliente, { nombre: "Toby" });
  return crearCita(negocio, {
    cliente,
    mascota,
    id_sucursal: sucursal.id_sucursal,
    id_empleado: empleado.id_empleado,
    fecha: proximo(LUNES),
    hora_inicio: "09:00:00",
    hora_fin: "09:30:00",
    estado: "confirmada",
    ...overrides,
  });
};

const tokenConPermisos = async (negocio, permisos) => {
  const usuario = await crearUsuario();
  const rol = await crearRol(negocio, permisos);
  const empleado = await crearEmpleado(negocio, { usuario, rol: rol.id_rol });
  return { empleado, token: await tokenDe(usuario) };
};

const url = (empleado, ruta = "disponibilidad") => `/empleados/${empleado.id_empleado}/${ruta}`;

describe("GET /empleados/:id_empleado/disponibilidad", () => {
  it("sin horario semanal: sigue el de la sucursal; lista las excepciones vigentes", async () => {
    const { empleado, token } = await contexto();
    const pasada = sumarDias(hoyISO(), -10);
    await pool.query(
      "INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica) VALUES (?, 'bloqueo', ?), (?, 'vacacion', ?)",
      [empleado.id_empleado, pasada, empleado.id_empleado, proximo(LUNES)]
    );

    const res = await api(token).get(url(empleado));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ horario_semanal: [], sigue_horario_sucursal: true });
    expect(res.body.data.excepciones).toEqual([
      expect.objectContaining({ tipo: "vacacion", fecha_especifica: proximo(LUNES), fecha_fin: null }),
    ]);

    const conPasadas = await api(token).get(`${url(empleado)}?desde=${pasada}&tipo=bloqueo`);
    expect(conPasadas.body.data.excepciones.map((e) => e.fecha_especifica)).toEqual([pasada]);
  });

  it("pueden ver: citas.ver o configuracion.ver, y el propio empleado; los demás empleados -> 403", async () => {
    const { negocio, empleado } = await contexto();
    for (const permisos of [{ citas: ["ver"] }, { configuracion: ["ver"] }]) {
      const { token } = await tokenConPermisos(negocio, permisos);
      expect((await api(token).get(url(empleado))).status).toBe(200);
    }
    const sinPermisos = await tokenConPermisos(negocio, { inventario: ["ver"] });
    expect((await api(sinPermisos.token).get(url(empleado))).status).toBe(403);
    expect((await api(sinPermisos.token).get(url(sinPermisos.empleado))).status).toBe(200);
  });

  it("el motivo solo llega con configuracion.ver, al propietario y al propio empleado; con solo citas.ver, null", async () => {
    const { negocio, token } = await contexto();
    const propio = await tokenConPermisos(negocio, { inventario: ["ver"] });
    await pool.query(
      "INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica, motivo) VALUES (?, 'bloqueo', ?, 'Cita médica personal')",
      [propio.empleado.id_empleado, proximo(LUNES)]
    );
    const motivo = async (t) => (await api(t).get(url(propio.empleado))).body.data.excepciones[0].motivo;

    const conConfiguracion = await tokenConPermisos(negocio, { configuracion: ["ver"] });
    for (const t of [token, conConfiguracion.token, propio.token]) expect(await motivo(t)).toBe("Cita médica personal");

    const soloCitas = await tokenConPermisos(negocio, { citas: ["ver"] });
    const res = await api(soloCitas.token).get(url(propio.empleado));
    expect(res.body.data.excepciones[0]).toMatchObject({ tipo: "bloqueo", fecha_especifica: proximo(LUNES), motivo: null });
    expect(JSON.stringify(res.body)).not.toContain("Cita médica personal");
  });

  it("sin token -> 401; empleado inexistente -> 404; hasta antes de desde -> 422", async () => {
    const { empleado, token } = await contexto();
    expect((await api().get(url(empleado))).status).toBe(401);
    expect((await api(token).get("/empleados/999999999/disponibilidad")).status).toBe(404);
    expect((await api(token).get(`${url(empleado)}?desde=2026-10-10&hasta=2026-10-01`)).status).toBe(422);
  });
});

describe("PUT /empleados/:id_empleado/horario-semanal", () => {
  it("reemplaza el horario semanal; lista vacía vuelve a seguir el de la sucursal", async () => {
    const { empleado, sucursal, token } = await contexto();
    const res = await api(token)
      .put(url(empleado, "horario-semanal"))
      .send({
        horarios: [
          { dia_semana: 3, hora_inicio: "14:00", hora_fin: "18:00", id_sucursal: sucursal.id_sucursal },
          { dia_semana: 1, hora_inicio: "08:00:00", hora_fin: "12:00" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Horario semanal actualizado");
    expect(res.body.data.horario_semanal).toEqual([
      { id_disponibilidad: expect.any(Number), dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: null },
      { id_disponibilidad: expect.any(Number), dia_semana: 3, hora_inicio: "14:00", hora_fin: "18:00", id_sucursal: sucursal.id_sucursal },
    ]);
    expect(res.body.data.citas_afectadas).toEqual([]);

    const vacio = await api(token).put(url(empleado, "horario-semanal")).send({ horarios: [] });
    expect(vacio.body.data.horario_semanal).toEqual([]);
    expect((await api(token).get(url(empleado))).body.data.sigue_horario_sucursal).toBe(true);
  });

  it("los rangos de un día no se cruzan aunque sean de sucursales distintas -> 422 con el índice", async () => {
    const { negocio, empleado, sucursal, token } = await contexto();
    const otra = await crearSucursal(negocio);
    const res = await api(token)
      .put(url(empleado, "horario-semanal"))
      .send({
        horarios: [
          { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: sucursal.id_sucursal },
          { dia_semana: 1, hora_inicio: "12:00", hora_fin: "13:00" },
          { dia_semana: 1, hora_inicio: "11:00", hora_fin: "14:00", id_sucursal: otra.id_sucursal },
        ],
      });
    expect(res.status).toBe(422);
    // 08–12 y 12–13 solo se tocan; 11–14 se cruza con los dos.
    expect(res.body.errors).toEqual({
      "horarios.2": "Se cruza con el rango de 08:00 a 12:00 del lunes",
      "horarios.1": "Se cruza con el rango de 11:00 a 14:00 del lunes",
    });
  });

  it("sucursal de otro negocio o inactiva -> 422; hora_fin no posterior -> 422", async () => {
    const { empleado, token } = await contexto();
    const ajena = await crearSucursal(await crearNegocio());
    const res = await api(token)
      .put(url(empleado, "horario-semanal"))
      .send({ horarios: [{ dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: ajena.id_sucursal }] });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ "horarios.0.id_sucursal": "La sucursal no existe o no está activa en este negocio" });

    const horas = await api(token)
      .put(url(empleado, "horario-semanal"))
      .send({ horarios: [{ dia_semana: 1, hora_inicio: "12:00", hora_fin: "08:00" }] });
    expect(horas.body.errors).toEqual({ "horarios.0.hora_fin": "Debe ser posterior a hora_inicio" });
  });

  it("devuelve las citas que quedan fuera del nuevo horario", async () => {
    const ctx = await contexto();
    const cita = await citaDe(ctx);
    const res = await api(ctx.token)
      .put(url(ctx.empleado, "horario-semanal"))
      .send({ horarios: [{ dia_semana: 2, hora_inicio: "08:00", hora_fin: "12:00" }] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Horario semanal actualizado. 1 cita queda fuera de la disponibilidad del empleado");
    expect(res.body.data.citas_afectadas).toEqual([
      {
        id_cita: cita.id_cita,
        fecha: proximo(LUNES),
        hora_inicio: "09:00",
        hora_fin: "09:30",
        estado: "confirmada",
        sucursal: { id_sucursal: ctx.sucursal.id_sucursal, nombre: "Sede Centro" },
        servicio: { id_servicio: cita.id_servicio, nombre: expect.any(String) },
        mascota: { id_mascota: cita.id_mascota, nombre: "Toby" },
        cliente: { id_usuario: cita.id_usuario, nombre: "Laura", apellido: "Díaz", telefono: "3005556677" },
      },
    ]);
  });

  it("empleado inactivo -> 409; recepcionista (sin configuracion.editar) -> 403", async () => {
    const { negocio, token } = await contexto();
    const inactivo = await crearEmpleado(negocio, { activo: false });
    const res = await api(token).put(url(inactivo, "horario-semanal")).send({ horarios: [] });
    expect(res.status).toBe(409);

    const recepcion = await tokenConPermisos(negocio, { citas: ["ver", "crear", "editar"] });
    expect((await api(recepcion.token).put(url(inactivo, "horario-semanal")).send({ horarios: [] })).status).toBe(403);
  });
});

describe("POST /empleados/:id_empleado/disponibilidad", () => {
  it("vacaciones sobre una cita: se guardan y la respuesta trae citas_afectadas (no las canceladas ni pasadas)", async () => {
    const ctx = await contexto();
    const cita = await citaDe(ctx);
    await citaDe(ctx, { estado: "cancelada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    await citaDe(ctx, { fecha: sumarDias(hoyISO(), -3) });

    const res = await api(ctx.token)
      .post(url(ctx.empleado))
      .send({ tipo: "vacacion", fecha_especifica: sumarDias(proximo(LUNES), -2), fecha_fin: proximo(LUNES), motivo: "Descanso" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Vacaciones registradas. 1 cita queda fuera de la disponibilidad del empleado");
    expect(res.body.data.disponibilidad).toMatchObject({
      id_empleado: ctx.empleado.id_empleado,
      tipo: "vacacion",
      fecha_fin: proximo(LUNES),
      hora_inicio: null,
      motivo: "Descanso",
    });
    expect(res.body.data.citas_afectadas.map((c) => c.id_cita)).toEqual([cita.id_cita]);
  });

  it("un bloqueo con horas que no toca la cita no la afecta", async () => {
    const ctx = await contexto();
    await citaDe(ctx);
    const res = await api(ctx.token)
      .post(url(ctx.empleado))
      .send({ tipo: "bloqueo", fecha_especifica: proximo(LUNES), hora_inicio: "10:00", hora_fin: "11:00" });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Bloqueo registrado");
    expect(res.body.data.citas_afectadas).toEqual([]);
  });

  it("valida por tipo: campos que no le corresponden, horas juntas, fechas y período", async () => {
    const { empleado, token } = await contexto();
    const post = (body) => api(token).post(url(empleado)).send(body);
    const dia = proximo(LUNES);

    const vacacionConHoras = await post({ tipo: "vacacion", fecha_especifica: dia, hora_inicio: "08:00" });
    expect(vacacionConHoras.status).toBe(422);
    expect(vacacionConHoras.body.errors).toEqual({ hora_inicio: "Campo no permitido" });

    const unaHora = await post({ tipo: "bloqueo", fecha_especifica: dia, hora_inicio: "08:00" });
    expect(unaHora.body.errors).toEqual({ hora_fin: "hora_inicio y hora_fin van juntas" });

    const alReves = await post({ tipo: "vacacion", fecha_especifica: dia, fecha_fin: sumarDias(dia, -1) });
    expect(alReves.body.errors).toEqual({ fecha_fin: "No puede ser anterior a fecha_especifica" });

    const largo = await post({ tipo: "vacacion", fecha_especifica: dia, fecha_fin: sumarDias(dia, 400) });
    expect(largo.body.errors).toEqual({ fecha_fin: "El período no puede superar 366 días" });

    const pasada = await post({ tipo: "bloqueo", fecha_especifica: sumarDias(hoyISO(), -1) });
    expect(pasada.body.errors).toEqual({ fecha_especifica: "La excepción ya pasó: el último día debe ser hoy o posterior" });

    const tipo = await post({ tipo: "horario_normal", fecha_especifica: dia });
    expect(tipo.body.errors).toEqual({ tipo: "Debe ser uno de: bloqueo, vacacion, evento_especial" });

    const recurrente = await post({ tipo: "bloqueo", fecha_especifica: dia, recurrente: true });
    expect(recurrente.body.errors).toEqual({ recurrente: "Campo no permitido" });
  });

  it("evento especial: sucursal obligatoria y del negocio; no se cruza con otro evento ese día", async () => {
    const { negocio, empleado, sucursal, token } = await contexto();
    const otra = await crearSucursal(negocio);
    const ajena = await crearSucursal(await crearNegocio());
    const post = (body) => api(token).post(url(empleado)).send({ tipo: "evento_especial", fecha_especifica: proximo(DOMINGO), ...body });

    expect((await post({ hora_inicio: "09:00", hora_fin: "13:00" })).body.errors).toEqual({ id_sucursal: "Campo obligatorio" });
    expect((await post({ hora_inicio: "09:00", hora_fin: "13:00", id_sucursal: ajena.id_sucursal })).body.errors).toEqual({
      id_sucursal: "La sucursal no existe o no está activa en este negocio",
    });

    const creado = await post({ hora_inicio: "09:00", hora_fin: "13:00", id_sucursal: sucursal.id_sucursal, motivo: "Jornada" });
    expect(creado.status).toBe(201);
    expect(creado.body.message).toBe("Evento especial registrado");

    const cruce = await post({ hora_inicio: "12:00", hora_fin: "14:00", id_sucursal: otra.id_sucursal });
    expect(cruce.status).toBe(422);
    expect(cruce.body.errors).toEqual({ hora_inicio: "Se cruza con otro evento especial del empleado ese día (09:00 a 13:00)" });

    expect((await post({ hora_inicio: "13:00", hora_fin: "15:00", id_sucursal: otra.id_sucursal })).status).toBe(201);
  });
});

describe("GET /empleados/:id_empleado/disponibilidad-efectiva", () => {
  it("la jornada de la tarde se suma a la mañana del horario normal", async () => {
    const { empleado, sucursal, token } = await contexto();
    await api(token)
      .put(url(empleado, "horario-semanal"))
      .send({ horarios: [{ dia_semana: LUNES, hora_inicio: "08:00", hora_fin: "12:00" }] });
    const lunes = proximo(LUNES);
    await api(token)
      .post(url(empleado))
      .send({ tipo: "evento_especial", fecha_especifica: lunes, hora_inicio: "14:00", hora_fin: "17:00", id_sucursal: sucursal.id_sucursal });

    const res = await api(token).get(`${url(empleado, "disponibilidad-efectiva")}?fecha=${lunes}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      fecha: lunes,
      dia_semana: 1,
      sigue_horario_sucursal: false,
      sucursales: [
        {
          id_sucursal: sucursal.id_sucursal,
          nombre: "Sede Centro",
          rangos: [
            { hora_inicio: "08:00", hora_fin: "12:00" },
            { hora_inicio: "14:00", hora_fin: "17:00" },
          ],
        },
      ],
    });
  });

  it("filtra por sucursal (422 si no es del negocio); fecha obligatoria; empleado inactivo sin rangos", async () => {
    const { negocio, empleado, sucursal, token } = await contexto();
    const efectiva = (query) => api(token).get(`${url(empleado, "disponibilidad-efectiva")}?${query}`);
    const lunes = proximo(LUNES);

    const conSucursal = await efectiva(`fecha=${lunes}&id_sucursal=${sucursal.id_sucursal}`);
    expect(conSucursal.body.data.sucursales).toHaveLength(1);
    expect(conSucursal.body.data.sucursales[0].rangos).toHaveLength(2);

    const ajena = await crearSucursal(await crearNegocio());
    expect((await efectiva(`fecha=${lunes}&id_sucursal=${ajena.id_sucursal}`)).status).toBe(422);
    expect((await efectiva("")).status).toBe(422);

    const inactivo = await crearEmpleado(negocio, { activo: false });
    const res = await api(token).get(`${url(inactivo, "disponibilidad-efectiva")}?fecha=${lunes}`);
    expect(res.body.data.sucursales[0].rangos).toEqual([]);
  });
});

describe("PATCH y DELETE /disponibilidad/:id_disponibilidad", () => {
  const crearExcepcion = async (token, empleado, body) => {
    const res = await api(token).post(url(empleado)).send(body);
    expect(res.status).toBe(201);
    return res.body.data.disponibilidad;
  };

  it("PATCH combina con los valores actuales y devuelve las citas afectadas", async () => {
    const ctx = await contexto();
    const cita = await citaDe(ctx);
    const lunes = proximo(LUNES);
    const bloqueo = await crearExcepcion(ctx.token, ctx.empleado, {
      tipo: "bloqueo",
      fecha_especifica: lunes,
      hora_inicio: "10:00",
      hora_fin: "11:00",
    });

    const res = await api(ctx.token).patch(`/disponibilidad/${bloqueo.id_disponibilidad}`).send({ hora_inicio: "08:30" });

    expect(res.status).toBe(200);
    expect(res.body.data.disponibilidad).toMatchObject({ hora_inicio: "08:30", hora_fin: "11:00", fecha_especifica: lunes });
    expect(res.body.data.citas_afectadas.map((c) => c.id_cita)).toEqual([cita.id_cita]);

    const invalido = await api(ctx.token).patch(`/disponibilidad/${bloqueo.id_disponibilidad}`).send({ hora_fin: "08:00" });
    expect(invalido.status).toBe(422);
    expect(invalido.body.errors).toEqual({ hora_fin: "Debe ser posterior a hora_inicio" });
  });

  it("PATCH: el tipo no cambia y no acepta campos de otro tipo -> 422; horario semanal -> 409", async () => {
    const { empleado, token } = await contexto();
    const vacacion = await crearExcepcion(token, empleado, { tipo: "vacacion", fecha_especifica: proximo(LUNES) });
    const ruta = `/disponibilidad/${vacacion.id_disponibilidad}`;

    expect((await api(token).patch(ruta).send({ tipo: "bloqueo" })).body.errors).toEqual({ tipo: "Campo no permitido" });
    expect((await api(token).patch(ruta).send({ hora_inicio: "08:00", hora_fin: "09:00" })).body.errors).toEqual({
      hora_inicio: "Campo no permitido",
      hora_fin: "Campo no permitido",
    });

    const semanal = await api(token)
      .put(url(empleado, "horario-semanal"))
      .send({ horarios: [{ dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00" }] });
    const id = semanal.body.data.horario_semanal[0].id_disponibilidad;
    const res = await api(token).patch(`/disponibilidad/${id}`).send({ motivo: "x" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("El horario semanal se cambia completo con PUT /empleados/:id_empleado/horario-semanal");
  });

  it("DELETE de un evento especial deja fuera las citas que caían en él; después 404", async () => {
    const ctx = await contexto();
    const domingo = proximo(DOMINGO);
    const evento = await crearExcepcion(ctx.token, ctx.empleado, {
      tipo: "evento_especial",
      fecha_especifica: domingo,
      hora_inicio: "09:00",
      hora_fin: "13:00",
      id_sucursal: ctx.sucursal.id_sucursal,
    });
    const cita = await citaDe(ctx, { fecha: domingo, hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const ruta = `/disponibilidad/${evento.id_disponibilidad}`;

    const res = await api(ctx.token).delete(ruta);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Disponibilidad eliminada. 1 cita queda fuera de la disponibilidad del empleado");
    expect(res.body.data).toEqual({ citas_afectadas: [expect.objectContaining({ id_cita: cita.id_cita })] });
    expect((await api(ctx.token).delete(ruta)).status).toBe(404);
    expect((await api(ctx.token).patch(ruta).send({ motivo: "x" })).status).toBe(404);
  });

  it("otro negocio -> 403; inexistente -> 404", async () => {
    const { empleado, token } = await contexto();
    const bloqueo = await crearExcepcion(token, empleado, { tipo: "bloqueo", fecha_especifica: proximo(LUNES) });
    const otro = await tokenDe((await crearNegocio()).propietario);
    expect((await api(otro).delete(`/disponibilidad/${bloqueo.id_disponibilidad}`)).status).toBe(403);
    expect((await api(token).delete("/disponibilidad/999999999")).status).toBe(404);
  });
});
