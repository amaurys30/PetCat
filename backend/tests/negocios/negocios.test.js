import { beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { aDatetimeSQL } from "../../src/shared/utils/fechas.js";
import {
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearNegocio,
  crearResena,
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

describe("POST /negocios", () => {
  it("cualquier usuario autenticado (también tipo cliente) crea un negocio con valores por defecto", async () => {
    const usuario = await crearUsuario({ tipo_usuario: "cliente" });
    const res = await api(await tokenDe(usuario))
      .post("/negocios")
      .send({ nombre: "Peluquería Guau", tipo: "peluqueria_canina" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Negocio creado");
    expect(res.body.data).toMatchObject({
      nombre: "Peluquería Guau",
      tipo: "peluqueria_canina",
      id_usuario_propietario: usuario.id_usuario,
      ciudad: "Sincelejo",
      departamento: "Sucre",
      pais: "Colombia",
      latitud: null,
      activo: true,
      verificado: false,
    });
  });

  it("crea en la misma transacción la suscripción Gratuita sin vencimiento", async () => {
    const res = await api(await tokenDe(await crearUsuario()))
      .post("/negocios")
      .send({ nombre: "Tienda Miau", tipo: "tienda_mascotas", nit: "900123456-7", latitud: 9.3, longitud: -75.4 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ nit: "900123456-7", latitud: 9.3, longitud: -75.4 });

    const [suscripciones] = await pool.query(
      `SELECT p.nombre AS plan, s.estado, s.fecha_fin FROM suscripciones s
       JOIN planes_suscripcion p ON p.id_plan = s.id_plan WHERE s.id_negocio = ?`,
      [res.body.data.id_negocio]
    );
    expect(suscripciones).toEqual([{ plan: "Gratuito", estado: "activa", fecha_fin: "9999-12-31" }]);
  });

  it("sin token -> 401", async () => {
    expect((await api().post("/negocios").send({ nombre: "X", tipo: "clinica" })).status).toBe(401);
  });

  it("valida el body -> 422", async () => {
    const token = await tokenDe(await crearUsuario());
    const res = await api(token)
      .post("/negocios")
      .send({ nombre: "A", tipo: "zoologico", latitud: 9.3, id_usuario_propietario: 1, email: "malo" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(
      ["email", "id_usuario_propietario", "nombre", "tipo"].sort()
    );

    const sinLongitud = await api(token).post("/negocios").send({ nombre: "Vet", tipo: "clinica", latitud: 9.3 });
    expect(sinLongitud.status).toBe(422);
    expect(sinLongitud.body.errors).toEqual({ longitud: "Latitud y longitud deben enviarse juntas" });
  });
});

describe("GET /negocios/mios", () => {
  it("devuelve los propios y aquellos donde es empleado activo, con relación y rol", async () => {
    const usuario = await crearUsuario();
    const propio = await crearNegocio(usuario);
    const ajeno = await crearNegocio();
    const rol = await crearRol(ajeno, { citas: ["ver"] }, { nombre: "Auxiliar" });
    const empleado = await crearEmpleado(ajeno, { usuario, rol: rol.id_rol });

    // No aparecen: empleo inactivo ni negocio inactivo.
    await crearEmpleado(await crearNegocio(), { usuario, activo: false });
    await crearEmpleado(await crearNegocio(null, { activo: false }), { usuario });

    const res = await api(await tokenDe(usuario)).get("/negocios/mios");
    expect(res.status).toBe(200);
    const porId = Object.fromEntries(res.body.data.map((n) => [n.id_negocio, n]));
    expect(Object.keys(porId).map(Number).sort()).toEqual([propio.id_negocio, ajeno.id_negocio].sort());
    expect(porId[propio.id_negocio]).toMatchObject({ relacion: "propietario", rol: null, id_empleado: null });
    expect(porId[ajeno.id_negocio]).toMatchObject({
      relacion: "empleado",
      id_empleado: empleado.id_empleado,
      rol: { id_rol: rol.id_rol, nombre: "Auxiliar", permisos_json: { citas: ["ver"] } },
    });
  });

  it("trae los permisos del rol aunque el empleado no tenga roles.ver", async () => {
    const usuario = await crearUsuario();
    const negocio = await crearNegocio();
    const rol = await crearRol(negocio, { citas: ["ver", "editar"], vacunas: ["ver"] });
    await crearEmpleado(negocio, { usuario, rol: rol.id_rol });
    const token = await tokenDe(usuario);

    expect((await api(token).get(`/negocios/${negocio.id_negocio}/roles`)).status).toBe(403);
    const [mio] = (await api(token).get("/negocios/mios")).body.data;
    expect(mio.rol.permisos_json).toEqual({ citas: ["ver", "editar"], vacunas: ["ver"] });
  });

  it("lista vacía si no tiene negocios", async () => {
    const res = await api(await tokenDe(await crearUsuario())).get("/negocios/mios");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("sin token -> 401", async () => {
    expect((await api().get("/negocios/mios")).status).toBe(401);
  });
});

describe("GET /negocios/:id_negocio (perfil público)", () => {
  let negocio;

  beforeAll(async () => {
    negocio = await crearNegocio(null, { descripcion: "Vet de barrio" });
    const principal = await crearSucursal(negocio, { nombre: "Principal", es_principal: true });
    const cerrada = await crearSucursal(negocio, { nombre: "Cerrada", activo: false });
    await crearHorarios(principal, [
      [1, "08:00", "12:00"],
      [1, "14:00", "18:00"],
    ]);
    await crearHorarios(cerrada, [[2, "08:00", "12:00"]]);
    await crearServicio(negocio, { nombre: "Consulta", tipo_mascota: "perro,gato", precio_base: 60000 });
    await crearServicio(negocio, { nombre: "Inactivo", activo: false });
    await crearServicio(negocio, { nombre: "Oculto", visible_app: false });
    await crearResena(negocio, { comentario: "Visible" });
    await crearResena(negocio, { comentario: "Oculta", visible: false });
  });

  it("sin token muestra solo sucursales, horarios y servicios activos y reseñas visibles", async () => {
    const res = await api().get(`/negocios/${negocio.id_negocio}`);
    expect(res.status).toBe(200);
    const perfil = res.body.data;

    expect(perfil).toMatchObject({ id_negocio: negocio.id_negocio, descripcion: "Vet de barrio", verificado: false });
    expect(perfil).not.toHaveProperty("nit");
    expect(perfil).not.toHaveProperty("id_usuario_propietario");

    expect(perfil.sucursales).toHaveLength(1);
    expect(perfil.sucursales[0]).toMatchObject({ nombre: "Principal", es_principal: true });
    expect(perfil.sucursales[0].horarios).toEqual([
      { dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" },
      { dia_semana: 1, hora_apertura: "14:00", hora_cierre: "18:00" },
    ]);

    expect(perfil.servicios.map((s) => s.nombre)).toEqual(["Consulta"]);
    expect(perfil.servicios[0]).toMatchObject({ precio_base: 60000, tipo_mascota: ["perro", "gato"] });

    expect(perfil.resenas_recientes.map((r) => r.comentario)).toEqual(["Visible"]);
    expect(perfil.resenas_recientes[0].autor).toMatch(/^Usuario P\.$/);
  });

  it("negocio inactivo o inexistente -> 404", async () => {
    const inactivo = await crearNegocio(null, { activo: false });
    expect((await api().get(`/negocios/${inactivo.id_negocio}`)).status).toBe(404);
    const inexistente = await api().get("/negocios/999999");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.message).toBe("Negocio no encontrado");
  });

  it("id no numérico -> 422", async () => {
    const res = await api().get("/negocios/abc");
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty("id_negocio");
  });
});

describe("GET /negocios/:id_negocio/gestion", () => {
  const haceDias = (dias) => aDatetimeSQL(new Date(Date.now() - dias * 86_400_000));
  const perdida = (negocio, dias) =>
    crearCita(negocio, { estado: "cancelada", cancelada_por: "sistema", fecha_cancelacion: haceDias(dias) });

  it("trae los datos privados, las sucursales activas con horarios y las reglas de confirmación", async () => {
    const negocio = await crearNegocio(null, { nit: "900123456-7", razon_social: "Patitas SAS", codigo_postal: "700001" });
    const principal = await crearSucursal(negocio, { nombre: "Principal", es_principal: true });
    await crearSucursal(negocio, { nombre: "Cerrada", activo: false });
    await crearHorarios(principal, [[1, "08:00", "12:00"]]);
    // Cuentan las canceladas por el sistema en los últimos 30 días, no las del dueño ni las viejas.
    await perdida(negocio, 1);
    await perdida(negocio, 29);
    await perdida(negocio, 31);
    await crearCita(negocio, { estado: "cancelada", cancelada_por: "dueno", fecha_cancelacion: haceDias(2) });

    const res = await api(await tokenDe(negocio.propietario)).get(`/negocios/${negocio.id_negocio}/gestion`);
    expect(res.status).toBe(200);
    const datos = res.body.data;
    expect(datos).toMatchObject({
      id_negocio: negocio.id_negocio,
      nit: "900123456-7",
      razon_social: "Patitas SAS",
      codigo_postal: "700001",
      pais: "Colombia",
      activo: true,
      confirmacion_automatica: false,
    });
    expect(datos.sucursales.map((s) => s.nombre)).toEqual(["Principal"]);
    expect(datos.sucursales[0].horarios).toEqual([{ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }]);
    expect(datos.reglas_confirmacion).toMatchObject({
      confirmacion_automatica: false,
      plazo_confirmacion_h: 24,
      confirmacion_antes_inicio_min: 60,
      citas_perdidas: { dias: 30, total: 2, sugerencia: { codigo: "activar_confirmacion_automatica" } },
    });
  });

  it("sin sugerencia con la confirmación automática encendida o sin citas perdidas", async () => {
    const automatico = await crearNegocio(null, { confirmacion_automatica: true });
    await perdida(automatico, 3);
    const conAuto = await api(await tokenDe(automatico.propietario)).get(`/negocios/${automatico.id_negocio}/gestion`);
    expect(conAuto.body.data.reglas_confirmacion.citas_perdidas).toEqual({ dias: 30, total: 1, sugerencia: null });

    const limpio = await crearNegocio();
    const sinPerdidas = await api(await tokenDe(limpio.propietario)).get(`/negocios/${limpio.id_negocio}/gestion`);
    expect(sinPerdidas.body.data.reglas_confirmacion.citas_perdidas).toEqual({ dias: 30, total: 0, sugerencia: null });
  });

  it("el propietario ve su negocio inactivo (el perfil público da 404)", async () => {
    const negocio = await crearNegocio(null, { activo: false });
    await crearSucursal(negocio, { nombre: "Única", es_principal: true });
    expect((await api().get(`/negocios/${negocio.id_negocio}`)).status).toBe(404);

    const res = await api(await tokenDe(negocio.propietario)).get(`/negocios/${negocio.id_negocio}/gestion`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ activo: false, sucursales: [{ nombre: "Única" }] });
  });

  it("empleado con configuracion.ver puede; sin el permiso o inactivo -> 403", async () => {
    const negocio = await crearNegocio();
    const lector = await crearUsuario();
    const sinPermiso = await crearUsuario();
    const inactivo = await crearUsuario();
    const rolLector = (await crearRol(negocio, { configuracion: ["ver"] })).id_rol;
    await crearEmpleado(negocio, { usuario: lector, rol: rolLector });
    await crearEmpleado(negocio, { usuario: sinPermiso, rol: (await crearRol(negocio, { citas: ["ver"] })).id_rol });
    await crearEmpleado(negocio, { usuario: inactivo, rol: rolLector, activo: false });
    const url = `/negocios/${negocio.id_negocio}/gestion`;

    expect((await api(await tokenDe(lector)).get(url)).status).toBe(200);
    expect((await api(await tokenDe(sinPermiso)).get(url)).status).toBe(403);
    expect((await api(await tokenDe(inactivo)).get(url)).status).toBe(403);
  });

  it("401 sin token, 403 negocio ajeno, 404 inexistente, 422 id inválido", async () => {
    const negocio = await crearNegocio();
    const url = `/negocios/${negocio.id_negocio}/gestion`;
    expect((await api().get(url)).status).toBe(401);
    expect((await api(await tokenDe(await crearUsuario())).get(url)).status).toBe(403);

    const propio = await tokenDe(negocio.propietario);
    expect((await api(propio).get("/negocios/999999/gestion")).status).toBe(404);
    expect((await api(propio).get("/negocios/abc/gestion")).status).toBe(422);
  });
});

describe("PATCH /negocios/:id_negocio", () => {
  it("el propietario actualiza campos de la lista blanca, incluidos nit y razon_social", async () => {
    const negocio = await crearNegocio();
    const res = await api(await tokenDe(negocio.propietario))
      .patch(`/negocios/${negocio.id_negocio}`)
      .send({ nit: "900555111-2", razon_social: "Patitas SAS", descripcion: null, latitud: 9.31, longitud: -75.39 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      nit: "900555111-2",
      razon_social: "Patitas SAS",
      descripcion: null,
      latitud: 9.31,
      longitud: -75.39,
    });
  });

  it("empleado con configuracion.editar puede; sin el permiso -> 403", async () => {
    const negocio = await crearNegocio();
    const conPermiso = await crearUsuario();
    const sinPermiso = await crearUsuario();
    await crearEmpleado(negocio, { usuario: conPermiso, rol: (await crearRol(negocio, { configuracion: ["ver", "editar"] })).id_rol });
    await crearEmpleado(negocio, { usuario: sinPermiso, rol: (await crearRol(negocio, { configuracion: ["ver"] })).id_rol });

    const ok = await api(await tokenDe(conPermiso)).patch(`/negocios/${negocio.id_negocio}`).send({ telefono: "3001234567" });
    expect(ok.status).toBe(200);

    const denegado = await api(await tokenDe(sinPermiso)).patch(`/negocios/${negocio.id_negocio}`).send({ telefono: "3001234567" });
    expect(denegado.status).toBe(403);
  });

  it("no permite cambiar campos fuera de la lista blanca -> 422", async () => {
    const negocio = await crearNegocio();
    const res = await api(await tokenDe(negocio.propietario))
      .patch(`/negocios/${negocio.id_negocio}`)
      .send({ id_usuario_propietario: 1, verificado: true, calificacion_promedio: 5 });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["calificacion_promedio", "id_usuario_propietario", "verificado"]);
  });

  it("body vacío o solo una coordenada -> 422", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);

    const vacio = await api(token).patch(`/negocios/${negocio.id_negocio}`).send({});
    expect(vacio.status).toBe(422);
    expect(vacio.body.errors).toEqual({ _: "Envía al menos un campo para actualizar" });

    const soloLatitud = await api(token).patch(`/negocios/${negocio.id_negocio}`).send({ latitud: 9.3 });
    expect(soloLatitud.status).toBe(422);
    expect(soloLatitud.body.errors).toHaveProperty("longitud");

    const nullYNumero = await api(token).patch(`/negocios/${negocio.id_negocio}`).send({ latitud: null, longitud: -75 });
    expect(nullYNumero.status).toBe(422);
  });

  it("401 sin token, 403 negocio ajeno, 404 inexistente", async () => {
    const negocio = await crearNegocio();
    expect((await api().patch(`/negocios/${negocio.id_negocio}`).send({ nombre: "Nuevo" })).status).toBe(401);

    const ajeno = await tokenDe(await crearUsuario());
    expect((await api(ajeno).patch(`/negocios/${negocio.id_negocio}`).send({ nombre: "Nuevo" })).status).toBe(403);

    const propio = await tokenDe(negocio.propietario);
    expect((await api(propio).patch("/negocios/999999").send({ nombre: "Nuevo" })).status).toBe(404);
  });
});
