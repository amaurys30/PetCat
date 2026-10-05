import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  categoriaServicio,
  crearCita,
  crearEmpleado,
  crearNegocio,
  crearServicio,
  crearUsuario,
  tokenDe,
  unique,
} from "../helpers/factories.js";

const diaRelativo = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/** Negocio con el token de su propietario y el id de una categoría. */
const contexto = async () => {
  const negocio = await crearNegocio();
  return {
    negocio,
    token: await tokenDe(negocio.propietario),
    id_categoria: await categoriaServicio("Consulta y diagnóstico"),
  };
};

/** Empleado vinculado a una cuenta, con su token (para probar permisos por rol). */
const empleadoConToken = async (negocio, rol) => {
  const usuario = await crearUsuario();
  await crearEmpleado(negocio, { usuario, rol });
  return tokenDe(usuario);
};

const asignados = async (id_servicio) => {
  const [rows] = await pool.query(
    "SELECT id_empleado FROM empleado_servicios WHERE id_servicio = ? ORDER BY id_empleado",
    [id_servicio]
  );
  return rows.map((row) => row.id_empleado);
};

describe("GET /categorias-servicio", () => {
  it("es público y devuelve las categorías activas en orden", async () => {
    const res = await api().get("/categorias-servicio");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.data[0]).toEqual({
      id_categoria: expect.any(Number),
      nombre: "Consulta y diagnóstico",
      descripcion: expect.any(String),
      icono: "stethoscope",
      orden_display: 1,
    });
  });
});

describe("POST /negocios/:id_negocio/servicios", () => {
  it("crea el servicio con sus empleados asignados y devuelve el formato del panel", async () => {
    const { negocio, token, id_categoria } = await contexto();
    const vet = await crearEmpleado(negocio, { nombre: "Carla", apellido: "Ríos" });

    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/servicios`)
      .send({
        id_categoria,
        nombre: "  Consulta a domicilio ",
        descripcion: "Visita en casa",
        precio_base: 80000,
        precio_maximo: 120000,
        tipo_precio: "variable",
        duracion_minutos: 45,
        margen_minutos: 15,
        tipo_mascota: ["perro", "gato", "perro"],
        peso_max_kg: 40,
        max_citas_dia: 4,
        dias_disponible: ["lunes", "miercoles"],
        etiquetas: ["domicilio", "premium"],
        empleados: [vet.id_empleado],
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Servicio creado");
    expect(res.body.data).toMatchObject({
      id_negocio: negocio.id_negocio,
      categoria: { id_categoria, nombre: "Consulta y diagnóstico" },
      nombre: "Consulta a domicilio",
      precio_base: 80000,
      precio_maximo: 120000,
      precio_actual: 80000,
      oferta_vigente: false,
      tipo_precio: "variable",
      duracion_minutos: 45,
      margen_minutos: 15,
      tipo_mascota: ["perro", "gato"],
      peso_min_kg: null,
      peso_max_kg: 40,
      requiere_cita: true,
      max_citas_dia: 4,
      dias_disponible: ["lunes", "miercoles"],
      etiquetas: ["domicilio", "premium"],
      visible_app: true,
      activo: true,
      empleados: [{ id_empleado: vet.id_empleado, nombre: "Carla", apellido: "Ríos" }],
      sin_empleados: false,
      reservable: true,
    });
    expect(res.body.data).not.toHaveProperty("id_categoria");
    expect(res.body.data).not.toHaveProperty("etiquetas_json");
  });

  it("con lo mínimo usa los valores por defecto y queda sin empleados", async () => {
    const { negocio, token, id_categoria } = await contexto();
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/servicios`)
      .send({ id_categoria, nombre: "Revisión", precio_base: 30000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      tipo_precio: "fijo",
      duracion_minutos: 30,
      margen_minutos: 0,
      tipo_mascota: ["todos"],
      dias_disponible: null,
      etiquetas: null,
      empleados: [],
      sin_empleados: true,
      reservable: false,
    });
  });

  it("valida categoría, empleados, especies y múltiplos de 5 -> 422", async () => {
    const { negocio, token, id_categoria } = await contexto();
    const ajeno = await crearEmpleado(await crearNegocio());
    const inactivo = await crearEmpleado(negocio, { activo: false });
    const url = `/negocios/${negocio.id_negocio}/servicios`;

    const categoria = await api(token).post(url).send({ id_categoria: 999999, nombre: "X1", precio_base: 1 });
    expect(categoria.status).toBe(422);
    expect(categoria.body.errors).toEqual({ id_categoria: "La categoría no existe" });

    const empleados = await api(token)
      .post(url)
      .send({ id_categoria, nombre: "X2", precio_base: 1, empleados: [ajeno.id_empleado, inactivo.id_empleado] });
    expect(empleados.status).toBe(422);
    expect(empleados.body.errors).toEqual({
      empleados: `No son empleados activos del negocio: ${ajeno.id_empleado}, ${inactivo.id_empleado}`,
    });

    const campos = await api(token)
      .post(url)
      .send({ id_categoria, nombre: "X3", precio_base: 1, tipo_mascota: ["todos", "perro"], duracion_minutos: 12, margen_minutos: 7 });
    expect(campos.status).toBe(422);
    expect(campos.body.errors).toEqual({
      tipo_mascota: "'todos' no se combina con otras especies",
      duracion_minutos: "Debe ser múltiplo de 5",
      margen_minutos: "Debe ser múltiplo de 5",
    });

    const extra = await api(token).post(url).send({ id_categoria, nombre: "X4", precio_base: 1, id_negocio: 1, activo: false });
    expect(extra.status).toBe(422);
    expect(extra.body.errors).toEqual({ id_negocio: "Campo no permitido", activo: "Campo no permitido" });
  });

  it("valida las reglas entre campos -> 422", async () => {
    const { negocio, token, id_categoria } = await contexto();
    const res = await api(token).post(`/negocios/${negocio.id_negocio}/servicios`).send({
      id_categoria,
      nombre: "Incoherente",
      precio_base: 50000,
      precio_maximo: 40000,
      peso_min_kg: 20,
      peso_max_kg: 10,
      en_oferta: true,
      fecha_inicio_oferta: "2026-10-10",
      fecha_fin_oferta: "2026-10-01",
    });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      precio_maximo: "Debe ser mayor o igual que precio_base",
      peso_max_kg: "Debe ser mayor o igual que peso_min_kg",
      precio_oferta: "Obligatorio si el servicio está en oferta",
      fecha_fin_oferta: "No puede ser anterior a fecha_inicio_oferta",
    });

    const oferta = await api(token)
      .post(`/negocios/${negocio.id_negocio}/servicios`)
      .send({ id_categoria, nombre: "Oferta cara", precio_base: 50000, en_oferta: true, precio_oferta: 50000 });
    expect(oferta.body.errors).toEqual({
      precio_oferta: "Debe ser menor que precio_base",
      fecha_inicio_oferta: "Obligatoria si el servicio está en oferta",
      fecha_fin_oferta: "Obligatoria si el servicio está en oferta",
    });
  });

  it("oferta: fechas obligatorias y fin no anterior a hoy -> 422; desde hoy hasta hoy, sí", async () => {
    const { negocio, token, id_categoria } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/servicios`;
    const base = { id_categoria, precio_base: 50000, en_oferta: true, precio_oferta: 40000 };

    const vencida = await api(token)
      .post(url)
      .send({ ...base, nombre: "Vencida", fecha_inicio_oferta: diaRelativo(-10), fecha_fin_oferta: diaRelativo(-1) });
    expect(vencida.status).toBe(422);
    expect(vencida.body.errors).toEqual({ fecha_fin_oferta: "No puede ser anterior a hoy" });

    const hoy = await api(token)
      .post(url)
      .send({ ...base, nombre: "De hoy", fecha_inicio_oferta: hoyISO(), fecha_fin_oferta: hoyISO() });
    expect(hoy.status).toBe(201);
    expect(hoy.body.data).toMatchObject({ oferta_vigente: true, precio_actual: 40000 });

    const sinOferta = await api(token)
      .post(url)
      .send({ id_categoria, nombre: "Sin oferta", precio_base: 50000, fecha_fin_oferta: diaRelativo(-1) });
    expect(sinOferta.status).toBe(201);
  });

  it("nombre repetido entre los activos (sin distinguir mayúsculas) -> 409; con uno eliminado, no", async () => {
    const { negocio, token, id_categoria } = await contexto();
    await crearServicio(negocio, { nombre: "Baño Medicado" });
    await crearServicio(negocio, { nombre: "Corte", activo: false });
    const url = `/negocios/${negocio.id_negocio}/servicios`;

    const repetido = await api(token).post(url).send({ id_categoria, nombre: "baño medicado", precio_base: 1 });
    expect(repetido.status).toBe(409);
    expect(repetido.body.errors).toEqual({ nombre: "Ya está en uso" });

    expect((await api(token).post(url).send({ id_categoria, nombre: "Corte", precio_base: 1 })).status).toBe(201);
  });

  it("sin token -> 401; recepcionista (solo servicios.ver) -> 403", async () => {
    const { negocio, id_categoria } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/servicios`;
    const body = { id_categoria, nombre: "Nuevo", precio_base: 1 };
    expect((await api().post(url).send(body)).status).toBe(401);
    const recepcion = await empleadoConToken(negocio, "Recepcionista");
    expect((await api(recepcion).post(url).send(body)).status).toBe(403);
  });
});

describe("GET /negocios/:id_negocio/servicios", () => {
  it("lista todos los servicios (activos primero) con empleados activos y sin_empleados", async () => {
    const { negocio, token } = await contexto();
    const activo = await crearEmpleado(negocio, { nombre: "Ana", apellido: "Activa" });
    const inactivo = await crearEmpleado(negocio, { activo: false });
    const conEmpleado = await crearServicio(negocio, { nombre: "B con empleado" });
    const soloInactivo = await crearServicio(negocio, { nombre: "C solo inactivo" });
    const eliminado = await crearServicio(negocio, { nombre: "A eliminado", activo: false });
    await asignarEmpleados(conEmpleado, [activo, inactivo]);
    await asignarEmpleados(soloInactivo, [inactivo]);

    const res = await api(token).get(`/negocios/${negocio.id_negocio}/servicios`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1, hasNext: false });
    expect(res.body.data.map((s) => s.id_servicio)).toEqual([
      conEmpleado.id_servicio,
      soloInactivo.id_servicio,
      eliminado.id_servicio,
    ]);
    expect(res.body.data[0]).toMatchObject({
      empleados: [{ id_empleado: activo.id_empleado, nombre: "Ana", apellido: "Activa" }],
      sin_empleados: false,
      reservable: true,
    });
    expect(res.body.data[1]).toMatchObject({ empleados: [], sin_empleados: true, reservable: false });
  });

  it("filtra por activo, visible_app, categoría y texto (los comodines se buscan literales)", async () => {
    const { negocio, token } = await contexto();
    const bano = await crearServicio(negocio, {
      nombre: "Baño 100%",
      id_categoria: await categoriaServicio("Baño y estética"),
    });
    const oculto = await crearServicio(negocio, { nombre: "Oculto", visible_app: false });
    await crearServicio(negocio, { nombre: "Eliminado", activo: false });
    const ids = async (query) =>
      (await api(token).get(`/negocios/${negocio.id_negocio}/servicios?${query}`)).body.data.map((s) => s.id_servicio);

    expect((await ids("activo=true")).sort()).toEqual([bano.id_servicio, oculto.id_servicio].sort());
    expect(await ids("visible_app=false")).toEqual([oculto.id_servicio]);
    expect(await ids(`id_categoria=${bano.id_categoria}`)).toEqual([bano.id_servicio]);
    expect(await ids("q=bano")).toEqual([bano.id_servicio]);
    expect(await ids("q=100%25")).toEqual([bano.id_servicio]);
    expect(await ids("q=_")).toEqual([]);
  });

  it("recepcionista con servicios.ver puede listar; alguien ajeno al negocio -> 403; negocio inexistente -> 404", async () => {
    const { negocio } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/servicios`;
    expect((await api(await empleadoConToken(negocio, "Recepcionista")).get(url)).status).toBe(200);
    expect((await api(await tokenDe(await crearUsuario())).get(url)).status).toBe(403);
    expect((await api(await tokenDe(negocio.propietario)).get("/negocios/999999999/servicios")).status).toBe(404);
  });
});

describe("PATCH /servicios/:id_servicio", () => {
  it("edita parcial y valida las reglas contra los valores actuales", async () => {
    const { negocio, token } = await contexto();
    const servicio = await crearServicio(negocio, { precio_base: 50000, precio_maximo: 70000 });
    const url = `/servicios/${servicio.id_servicio}`;

    const bajo = await api(token).patch(url).send({ precio_maximo: 40000 });
    expect(bajo.status).toBe(422);
    expect(bajo.body.errors).toEqual({ precio_maximo: "Debe ser mayor o igual que precio_base" });

    const res = await api(token).patch(url).send({ descripcion: "Nueva", margen_minutos: 10, dias_disponible: null });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Servicio actualizado");
    expect(res.body.data).toMatchObject({ descripcion: "Nueva", margen_minutos: 10, precio_maximo: 70000, dias_disponible: null });
  });

  it("indicaciones_previas: se crean, se editan, null las quita, máximo 500 y se ven en el detalle público", async () => {
    const { negocio, token, id_categoria } = await contexto();
    const creado = await api(token)
      .post(`/negocios/${negocio.id_negocio}/servicios`)
      .send({ id_categoria, nombre: "Cirugía menor", precio_base: 250000, indicaciones_previas: "  Ayuno de 8 horas  " });
    expect(creado.status).toBe(201);
    expect(creado.body.data.indicaciones_previas).toBe("Ayuno de 8 horas");
    const url = `/servicios/${creado.body.data.id_servicio}`;

    const editado = await api(token).patch(url).send({ indicaciones_previas: "Ayuno de 12 horas. Trae el carnet de vacunas." });
    expect(editado.body.data.indicaciones_previas).toBe("Ayuno de 12 horas. Trae el carnet de vacunas.");
    expect((await api().get(url)).body.data.indicaciones_previas).toBe("Ayuno de 12 horas. Trae el carnet de vacunas.");

    const largo = await api(token).patch(url).send({ indicaciones_previas: "a".repeat(501) });
    expect(largo.status).toBe(422);
    expect(largo.body.errors).toHaveProperty("indicaciones_previas");

    const vacio = await api(token).patch(url).send({ indicaciones_previas: null });
    expect(vacio.body.data.indicaciones_previas).toBeNull();
  });

  it("empleados reemplaza los activos asignados y conserva los inactivos; [] lo deja sin empleados", async () => {
    const { negocio, token } = await contexto();
    const [a, b, c] = [await crearEmpleado(negocio), await crearEmpleado(negocio), await crearEmpleado(negocio)];
    const inactivo = await crearEmpleado(negocio, { activo: false });
    const servicio = await crearServicio(negocio);
    await asignarEmpleados(servicio, [a, b, inactivo]);
    const url = `/servicios/${servicio.id_servicio}`;

    const res = await api(token).patch(url).send({ empleados: [b.id_empleado, c.id_empleado] });
    expect(res.status).toBe(200);
    expect(res.body.data.empleados.map((e) => e.id_empleado).sort()).toEqual([b.id_empleado, c.id_empleado].sort());
    expect(await asignados(servicio.id_servicio)).toEqual(
      [b.id_empleado, c.id_empleado, inactivo.id_empleado].sort((x, y) => x - y)
    );

    const vacio = await api(token).patch(url).send({ empleados: [] });
    expect(vacio.body.data).toMatchObject({ empleados: [], sin_empleados: true });
    expect(await asignados(servicio.id_servicio)).toEqual([inactivo.id_empleado]);
  });

  it("oferta vigente cambia precio_actual; una vencida no", async () => {
    const { negocio, token } = await contexto();
    const servicio = await crearServicio(negocio, { precio_base: 50000 });
    const url = `/servicios/${servicio.id_servicio}`;

    const vigente = await api(token)
      .patch(url)
      .send({ en_oferta: true, precio_oferta: 40000, fecha_inicio_oferta: diaRelativo(-1), fecha_fin_oferta: diaRelativo(1) });
    expect(vigente.body.data).toMatchObject({ precio_actual: 40000, oferta_vigente: true });

    // La oferta vence con el paso de los días (la API ya no acepta poner un fin pasado).
    await pool.query("UPDATE servicios SET fecha_inicio_oferta = ?, fecha_fin_oferta = ? WHERE id_servicio = ?", [
      diaRelativo(-5),
      diaRelativo(-1),
      servicio.id_servicio,
    ]);
    const vencida = await api(token).get(`/negocios/${negocio.id_negocio}/servicios`);
    expect(vencida.body.data[0]).toMatchObject({ precio_actual: 50000, oferta_vigente: false, en_oferta: true });
  });

  it("oferta vencida: se edita lo demás sin tocarla; al cambiarla se exige un fin desde hoy", async () => {
    const { negocio, token } = await contexto();
    const servicio = await crearServicio(negocio, {
      precio_base: 50000,
      en_oferta: true,
      precio_oferta: 40000,
      fecha_inicio_oferta: diaRelativo(-10),
      fecha_fin_oferta: diaRelativo(-1),
    });
    const url = `/servicios/${servicio.id_servicio}`;

    // Mismos valores de la oferta (un formulario que envía todo): no cuenta como cambio.
    const otroCampo = await api(token).patch(url).send({
      descripcion: "Nueva",
      en_oferta: true,
      precio_oferta: 40000,
      fecha_inicio_oferta: diaRelativo(-10),
      fecha_fin_oferta: diaRelativo(-1),
    });
    expect(otroCampo.status).toBe(200);

    const precio = await api(token).patch(url).send({ precio_oferta: 35000 });
    expect(precio.status).toBe(422);
    expect(precio.body.errors).toEqual({ fecha_fin_oferta: "No puede ser anterior a hoy" });

    const quitarFechas = await api(token).patch(url).send({ fecha_inicio_oferta: null, fecha_fin_oferta: diaRelativo(3) });
    expect(quitarFechas.body.errors).toEqual({ fecha_inicio_oferta: "Obligatoria si el servicio está en oferta" });

    const renovada = await api(token).patch(url).send({ fecha_inicio_oferta: hoyISO(), fecha_fin_oferta: diaRelativo(3) });
    expect(renovada.status).toBe(200);
    expect(renovada.body.data).toMatchObject({ oferta_vigente: true, precio_actual: 40000 });

    const apagada = await api(token).patch(url).send({ en_oferta: false, precio_oferta: null, fecha_inicio_oferta: null, fecha_fin_oferta: null });
    expect(apagada.status).toBe(200);
    expect(apagada.body.data).toMatchObject({ en_oferta: false, precio_oferta: null, oferta_vigente: false });
  });

  it("nombre de otro servicio activo -> 409; servicio de otro negocio -> 403; inexistente -> 404", async () => {
    const { negocio, token } = await contexto();
    await crearServicio(negocio, { nombre: "Ocupado" });
    const servicio = await crearServicio(negocio);
    expect((await api(token).patch(`/servicios/${servicio.id_servicio}`).send({ nombre: "OCUPADO" })).status).toBe(409);

    const otro = await contexto();
    expect((await api(otro.token).patch(`/servicios/${servicio.id_servicio}`).send({ nombre: "Otro nombre" })).status).toBe(403);
    expect((await api(token).patch("/servicios/999999999").send({ nombre: "Otro nombre" })).status).toBe(404);
    expect((await api(token).patch(`/servicios/${servicio.id_servicio}`).send({})).status).toBe(422);
  });

  it("empleados de otro negocio -> 422", async () => {
    const { negocio, token } = await contexto();
    const servicio = await crearServicio(negocio);
    const ajeno = await crearEmpleado(await crearNegocio());
    const res = await api(token).patch(`/servicios/${servicio.id_servicio}`).send({ empleados: [ajeno.id_empleado] });
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty("empleados");
  });
});

describe("DELETE y reactivar /servicios/:id_servicio", () => {
  it("elimina (lógico) conservando las asignaciones, luego 404; reactivar lo devuelve", async () => {
    const { negocio, token } = await contexto();
    const empleado = await crearEmpleado(negocio);
    const servicio = await crearServicio(negocio);
    await asignarEmpleados(servicio, [empleado]);
    const url = `/servicios/${servicio.id_servicio}`;

    const res = await api(token).delete(url);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Servicio eliminado", data: null });
    expect((await api(token).delete(url)).status).toBe(404);
    expect((await api().get(url)).status).toBe(404);
    expect(await asignados(servicio.id_servicio)).toEqual([empleado.id_empleado]);

    const reactivado = await api(token).patch(`${url}/reactivar`);
    expect(reactivado.status).toBe(200);
    expect(reactivado.body.data).toMatchObject({ activo: true, sin_empleados: false });
    expect((await api(token).patch(`${url}/reactivar`)).status).toBe(409);
  });

  it("con citas futuras pendientes o confirmadas -> 409", async () => {
    const { negocio, token } = await contexto();
    const servicio = await crearServicio(negocio);
    await crearCita(negocio, { servicio, estado: "confirmada" });
    const res = await api(token).delete(`/servicios/${servicio.id_servicio}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "El servicio tiene citas pendientes o confirmadas: cancélalas o reprográmalas antes de eliminarlo"
    );
  });

  it("reactivar con el nombre ocupado por otro activo -> 409", async () => {
    const { negocio, token } = await contexto();
    const eliminado = await crearServicio(negocio, { nombre: "Guardería", activo: false });
    await crearServicio(negocio, { nombre: "guardería" });
    const res = await api(token).patch(`/servicios/${eliminado.id_servicio}/reactivar`);
    expect(res.status).toBe(409);
    expect(res.body.errors).toEqual({ nombre: "Ya está en uso" });
  });

  it("veterinario (sin servicios.eliminar) -> 403", async () => {
    const { negocio } = await contexto();
    const servicio = await crearServicio(negocio);
    const vet = await empleadoConToken(negocio, "Veterinario");
    expect((await api(vet).delete(`/servicios/${servicio.id_servicio}`)).status).toBe(403);
  });
});

describe("GET /servicios/:id_servicio (público)", () => {
  it("devuelve el servicio visible con sus empleados activos (especialidad y foto)", async () => {
    const { negocio } = await contexto();
    const empleado = await crearEmpleado(negocio, { nombre: "Luis", apellido: "Mora", especialidad: "Cirugía" });
    const servicio = await crearServicio(negocio, { nombre: `Cirugía ${unique()}`, tipo_mascota: "perro,gato" });
    await asignarEmpleados(servicio, [empleado]);

    const res = await api().get(`/servicios/${servicio.id_servicio}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id_servicio: servicio.id_servicio,
      negocio: { id_negocio: negocio.id_negocio, nombre: negocio.nombre },
      categoria: { nombre: "Consulta y diagnóstico" },
      tipo_mascota: ["perro", "gato"],
      reservable: true,
      empleados: [
        { id_empleado: empleado.id_empleado, nombre: "Luis", apellido: "Mora", especialidad: "Cirugía", foto_url: null },
      ],
    });
    expect(res.body.data).not.toHaveProperty("margen_minutos");
    expect(res.body.data).not.toHaveProperty("distancia_km");
  });

  it("oculto en la app, eliminado o de un negocio inactivo -> 404", async () => {
    const { negocio } = await contexto();
    const oculto = await crearServicio(negocio, { visible_app: false });
    const eliminado = await crearServicio(negocio, { activo: false });
    const deInactivo = await crearServicio(await crearNegocio(null, { activo: false }));
    for (const s of [oculto, eliminado, deInactivo]) {
      expect((await api().get(`/servicios/${s.id_servicio}`)).status).toBe(404);
    }
  });
});

describe("detalle del empleado", () => {
  it("GET /empleados/:id_empleado incluye los servicios activos que atiende", async () => {
    const { negocio, token } = await contexto();
    const empleado = await crearEmpleado(negocio);
    const atiende = await crearServicio(negocio, { nombre: "Atiende" });
    const eliminado = await crearServicio(negocio, { nombre: "Eliminado", activo: false });
    await asignarEmpleados(atiende, [empleado]);
    await asignarEmpleados(eliminado, [empleado]);

    const res = await api(token).get(`/empleados/${empleado.id_empleado}`);
    expect(res.body.data.servicios).toEqual([{ id_servicio: atiende.id_servicio, nombre: "Atiende" }]);
  });
});
