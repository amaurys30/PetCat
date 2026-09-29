import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearNegocio, crearSucursal, crearUsuario, rolDelSistema, tokenDe, unique } from "../helpers/factories.js";

const sucursalBody = () => ({ nombre: `Sede ${unique()}`, direccion: "Calle 1 # 2-3" });
const empleadoBody = async () => ({
  id_rol: await rolDelSistema("Recepcionista"),
  nombre: "Ana",
  apellido: "Pérez",
  email: `empleado_${unique()}@petcat.test`,
});

const conToken = async (plan = "Gratuito") => {
  const negocio = await crearNegocio(null, { plan });
  return { negocio, token: await tokenDe(negocio.propietario) };
};

describe("límite de sucursales", () => {
  it("Gratuito: con una sucursal activa, crear otra da 403 con errors.plan; las inactivas no cuentan", async () => {
    const { negocio, token } = await conToken();
    await crearSucursal(negocio, { activo: false });
    const ruta = `/negocios/${negocio.id_negocio}/sucursales`;

    expect((await api(token).post(ruta).send(sucursalBody())).status).toBe(201);
    const res = await api(token).post(ruta).send(sucursalBody());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      message: "Tu plan Gratuito permite hasta 1 sucursal activa. Mejora tu plan para continuar.",
      errors: { plan: "Límite de sucursales alcanzado (1 de 1)" },
    });
  });

  it("Pro: hasta 3 sucursales activas", async () => {
    const { negocio, token } = await conToken("Pro");
    await crearSucursal(negocio);
    await crearSucursal(negocio);
    const ruta = `/negocios/${negocio.id_negocio}/sucursales`;
    expect((await api(token).post(ruta).send(sucursalBody())).status).toBe(201);
    const res = await api(token).post(ruta).send(sucursalBody());
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Tu plan Pro permite hasta 3 sucursales activas. Mejora tu plan para continuar.");
  });

  it("una prueba Pro vencida vuelve a los límites del Gratuito sin desactivar lo existente", async () => {
    const { negocio, token } = await conToken();
    await api(token).post(`/negocios/${negocio.id_negocio}/suscripcion/prueba-pro`);
    const ruta = `/negocios/${negocio.id_negocio}/sucursales`;
    const primera = await api(token).post(ruta).send(sucursalBody());
    const segunda = await api(token).post(ruta).send(sucursalBody());
    expect([primera.status, segunda.status]).toEqual([201, 201]);

    await pool.query(
      `UPDATE suscripciones SET fecha_fin = CURDATE() - INTERVAL 1 DAY, fecha_prueba_fin = CURDATE() - INTERVAL 1 DAY
       WHERE id_negocio = ? AND estado = 'en_prueba'`,
      [negocio.id_negocio]
    );
    expect((await api(token).post(ruta).send(sucursalBody())).status).toBe(403);
    // Las dos sucursales siguen activas y se pueden editar.
    const editar = await api(token).patch(`/sucursales/${segunda.body.data.id_sucursal}`).send({ nombre: "Sede editada" });
    expect(editar.status).toBe(200);
    const [[{ activas }]] = await pool.query(
      "SELECT COUNT(*) AS activas FROM sucursales WHERE id_negocio = ? AND activo = TRUE",
      [negocio.id_negocio]
    );
    expect(activas).toBe(2);
  });

  it("sin permiso responde el 403 genérico, antes de mirar el plan; el body inválido da 422", async () => {
    const { negocio, token } = await conToken();
    await crearSucursal(negocio);
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    const ruta = `/negocios/${negocio.id_negocio}/sucursales`;

    const sinPermiso = await api(await tokenDe(recepcion)).post(ruta).send(sucursalBody());
    expect(sinPermiso.status).toBe(403);
    expect(sinPermiso.body.errors).toBeUndefined();
    expect((await api(token).post(ruta).send({})).status).toBe(422);
  });

  it("dos altas simultáneas no pasan del límite", async () => {
    const { negocio, token } = await conToken();
    const ruta = `/negocios/${negocio.id_negocio}/sucursales`;
    const respuestas = await Promise.all([1, 2, 3].map(() => api(token).post(ruta).send(sucursalBody())));
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 403, 403]);
  });
});

describe("límite de empleados", () => {
  it("Gratuito: 3 empleados activos; el cuarto da 403 y los inactivos no cuentan", async () => {
    const { negocio, token } = await conToken();
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    await crearEmpleado(negocio, { activo: false });
    const ruta = `/negocios/${negocio.id_negocio}/empleados`;

    expect((await api(token).post(ruta).send(await empleadoBody())).status).toBe(201);
    const res = await api(token).post(ruta).send(await empleadoBody());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      message: "Tu plan Gratuito permite hasta 3 empleados activos. Mejora tu plan para continuar.",
      errors: { plan: "Límite de empleados alcanzado (3 de 3)" },
    });
  });

  it("el propietario registrado como empleado no ocupa cupo, tampoco al registrarse con el límite lleno", async () => {
    const { negocio, token } = await conToken();
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);

    const yo = await api(token).post(`/negocios/${negocio.id_negocio}/empleados/yo`).send({});
    expect(yo.status).toBe(201);
    const suscripcion = await api(token).get(`/negocios/${negocio.id_negocio}/suscripcion`);
    expect(suscripcion.body.data.uso.empleados).toEqual({ usadas: 3, maximo: 3 });
  });

  it("con el propietario como empleado y dos más, se puede crear un tercero", async () => {
    const { negocio, token } = await conToken();
    await crearEmpleado(negocio, { usuario: negocio.propietario, rol: "Administrador" });
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    expect((await api(token).post(`/negocios/${negocio.id_negocio}/empleados`).send(await empleadoBody())).status).toBe(201);
  });

  it("reactivar cuenta para el límite, salvo el propietario registrado como empleado", async () => {
    const { negocio, token } = await conToken();
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    const inactivo = await crearEmpleado(negocio, { activo: false });
    const propietario = await crearEmpleado(negocio, { usuario: negocio.propietario, rol: "Administrador", activo: false });

    const res = await api(token).patch(`/empleados/${inactivo.id_empleado}/reactivar`);
    expect(res.status).toBe(403);
    expect(res.body.errors).toEqual({ plan: "Límite de empleados alcanzado (3 de 3)" });
    expect((await api(token).patch(`/empleados/${propietario.id_empleado}/reactivar`)).status).toBe(200);
  });

  it("Pro: empleados ilimitados", async () => {
    const { negocio, token } = await conToken("Pro");
    for (let i = 0; i < 4; i++) await crearEmpleado(negocio);
    expect((await api(token).post(`/negocios/${negocio.id_negocio}/empleados`).send(await empleadoBody())).status).toBe(201);
  });

  it("dos altas simultáneas no pasan del límite", async () => {
    const { negocio, token } = await conToken();
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    const ruta = `/negocios/${negocio.id_negocio}/empleados`;
    const bodies = await Promise.all([1, 2, 3].map(() => empleadoBody()));
    const respuestas = await Promise.all(bodies.map((body) => api(token).post(ruta).send(body)));
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 403, 403]);
  });
});
