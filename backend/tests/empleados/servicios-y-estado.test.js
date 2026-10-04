import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  crearEmpleado,
  crearInvitacion,
  crearNegocio,
  crearRol,
  crearServicio,
  crearUsuario,
  rolDelSistema,
  tokenDe,
} from "../helpers/factories.js";

const negocioConToken = async () => {
  const negocio = await crearNegocio(undefined, { plan: "Pro" });
  return { negocio, token: await tokenDe(negocio.propietario) };
};

const asignados = async (id_empleado) => {
  const [rows] = await pool.query(
    "SELECT id_servicio FROM empleado_servicios WHERE id_empleado = ? ORDER BY id_servicio",
    [id_empleado]
  );
  return rows.map((r) => r.id_servicio);
};

describe("listado de empleados: servicios, propietario e invitación", () => {
  it("trae los servicios activos que atiende cada empleado y marca al propietario", async () => {
    const { negocio, token } = await negocioConToken();
    const propio = await crearEmpleado(negocio, { usuario: negocio.propietario, apellido: "Abril" });
    const vet = await crearEmpleado(negocio, { apellido: "Bernal" });
    const consulta = await crearServicio(negocio, { nombre: "Consulta" });
    const baño = await crearServicio(negocio, { nombre: "Baño" });
    const eliminado = await crearServicio(negocio, { nombre: "Antiguo", activo: false });
    await asignarEmpleados(consulta, [vet, propio]);
    await asignarEmpleados(baño, [vet]);
    await asignarEmpleados(eliminado, [vet]);

    const res = await api(token).get(`/negocios/${negocio.id_negocio}/empleados`);
    expect(res.status).toBe(200);
    const [a, b] = res.body.data;
    expect(a).toMatchObject({ id_empleado: propio.id_empleado, es_propietario: true });
    expect(a.servicios).toEqual([{ id_servicio: consulta.id_servicio, nombre: "Consulta" }]);
    expect(b).toMatchObject({ id_empleado: vet.id_empleado, es_propietario: false });
    expect(b.servicios.map((s) => s.nombre)).toEqual(["Baño", "Consulta"]);
  });

  it("invitacion: null con cuenta, sin email o inactivo; vencimiento y envíos restantes", async () => {
    const { negocio, token } = await negocioConToken();
    const conCuenta = await crearEmpleado(negocio, { usuario: await crearUsuario(), apellido: "A" });
    const sinEmail = await crearEmpleado(negocio, { email: null, apellido: "B" });
    const inactivo = await crearEmpleado(negocio, { activo: false, apellido: "C" });
    const nuevo = await crearEmpleado(negocio, { apellido: "D" });
    const invitado = await crearEmpleado(negocio, { apellido: "E" });
    const invitacion = await crearInvitacion(invitado);
    const agotado = await crearEmpleado(negocio, { apellido: "F" });
    for (let i = 0; i < 4; i++) await crearInvitacion(agotado);
    // Un envío de hace más de 24 horas ya no cuenta.
    const viejo = await crearEmpleado(negocio, { apellido: "G" });
    await crearInvitacion(viejo, { fecha_creacion: "2020-01-01 00:00:00", expiracion: "2020-01-04 00:00:00" });

    const res = await api(token).get(`/negocios/${negocio.id_negocio}/empleados?limit=50`);
    const por = Object.fromEntries(res.body.data.map((e) => [e.id_empleado, e.invitacion]));
    expect(por[conCuenta.id_empleado]).toBeNull();
    expect(por[sinEmail.id_empleado]).toBeNull();
    expect(por[inactivo.id_empleado]).toBeNull();
    expect(por[nuevo.id_empleado]).toEqual({ expiracion: null, envios_restantes_24h: 4, libre_desde: null });
    expect(por[invitado.id_empleado]).toEqual({
      expiracion: invitacion.expiracion,
      envios_restantes_24h: 3,
      libre_desde: null,
    });
    expect(por[agotado.id_empleado]).toMatchObject({ envios_restantes_24h: 0, libre_desde: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/) });
    expect(por[viejo.id_empleado]).toEqual({ expiracion: null, envios_restantes_24h: 4, libre_desde: null });
  });

  it("el detalle trae los mismos campos", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    await crearInvitacion(empleado);
    const res = await api(token).get(`/empleados/${empleado.id_empleado}`);
    expect(res.body.data).toMatchObject({
      es_propietario: false,
      servicios: [],
      invitacion: { envios_restantes_24h: 3, libre_desde: null },
    });
  });
});

describe("servicios desde el empleado", () => {
  it("POST crea el empleado con sus servicios; 422 si alguno no es un servicio activo del negocio (no crea nada)", async () => {
    const { negocio, token } = await negocioConToken();
    const a = await crearServicio(negocio);
    const b = await crearServicio(negocio);
    const url = `/negocios/${negocio.id_negocio}/empleados`;
    const body = { nombre: "Laura", apellido: "Díaz", id_rol: await rolDelSistema("Veterinario") };

    const res = await api(token).post(url).send({ ...body, servicios: [b.id_servicio, a.id_servicio, a.id_servicio] });
    expect(res.status).toBe(201);
    expect(res.body.data.servicios.map((s) => s.id_servicio).sort()).toEqual([a.id_servicio, b.id_servicio].sort());

    const ajeno = await crearServicio(await crearNegocio());
    const inactivo = await crearServicio(negocio, { activo: false });
    const [[{ antes }]] = await pool.query("SELECT COUNT(*) AS antes FROM empleados WHERE id_negocio = ?", [negocio.id_negocio]);
    const invalido = await api(token)
      .post(url)
      .send({ ...body, servicios: [a.id_servicio, ajeno.id_servicio, inactivo.id_servicio, 999999] });
    expect(invalido.status).toBe(422);
    expect(invalido.body.errors.servicios).toBe(
      `No son servicios activos del negocio: ${[ajeno.id_servicio, inactivo.id_servicio, 999999].join(", ")}`
    );
    const [[{ despues }]] = await pool.query("SELECT COUNT(*) AS despues FROM empleados WHERE id_negocio = ?", [negocio.id_negocio]);
    expect(despues).toBe(antes);

    expect((await api(token).post(url).send({ ...body, servicios: ["x"] })).status).toBe(422);
  });

  it("PATCH reemplaza los servicios activos, [] los quita y conserva los de servicios eliminados", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    const a = await crearServicio(negocio);
    const b = await crearServicio(negocio);
    const eliminado = await crearServicio(negocio, { activo: false });
    await asignarEmpleados(a, [empleado]);
    await asignarEmpleados(eliminado, [empleado]);
    const url = `/empleados/${empleado.id_empleado}`;

    const res = await api(token).patch(url).send({ servicios: [b.id_servicio] });
    expect(res.status).toBe(200);
    expect(res.body.data.servicios.map((s) => s.id_servicio)).toEqual([b.id_servicio]);
    expect(await asignados(empleado.id_empleado)).toEqual([b.id_servicio, eliminado.id_servicio].sort((x, y) => x - y));

    // El servicio lo refleja.
    const servicio = await api(token).get(`/servicios/${b.id_servicio}`);
    expect(servicio.body.data.empleados.map((e) => e.id_empleado)).toContain(empleado.id_empleado);

    const vacio = await api(token).patch(url).send({ servicios: [] });
    expect(vacio.body.data.servicios).toEqual([]);
    expect(await asignados(empleado.id_empleado)).toEqual([eliminado.id_servicio]);

    // Un error en los servicios deshace también el resto del cambio.
    const ajeno = await crearServicio(await crearNegocio());
    expect((await api(token).patch(url).send({ nombre: "Cambiado", servicios: [ajeno.id_servicio] })).status).toBe(422);
    expect((await api(token).get(url)).body.data.nombre).not.toBe("Cambiado");
  });

  it("PATCH con servicios a un empleado inactivo -> 409", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio, { activo: false });
    const servicio = await crearServicio(negocio);
    const res = await api(token).patch(`/empleados/${empleado.id_empleado}`).send({ servicios: [servicio.id_servicio] });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("El empleado está inactivo: reactívalo antes de asignarle servicios");
  });

  it("un empleado sin servicios.editar no puede asignar servicios (403), pero sí editar lo demás", async () => {
    const { negocio } = await negocioConToken();
    const servicio = await crearServicio(negocio);
    const rol = await crearRol(negocio, { empleados: ["ver", "crear", "editar"], servicios: ["ver"] });
    const coordinador = await crearUsuario();
    await crearEmpleado(negocio, { usuario: coordinador, rol: rol.id_rol });
    const token = await tokenDe(coordinador);
    const otro = await crearEmpleado(negocio, { rol: rol.id_rol });

    const patch = await api(token).patch(`/empleados/${otro.id_empleado}`).send({ servicios: [servicio.id_servicio] });
    expect(patch.status).toBe(403);
    expect(patch.body.message).toBe("Para asignar servicios necesitas el permiso de editar servicios");
    expect((await api(token).patch(`/empleados/${otro.id_empleado}`).send({ notas: "Ok" })).status).toBe(200);

    const post = await api(token)
      .post(`/negocios/${negocio.id_negocio}/empleados`)
      .send({ nombre: "Ana", apellido: "Mora", id_rol: rol.id_rol, servicios: [servicio.id_servicio] });
    expect(post.status).toBe(403);

    const conServicios = await crearRol(negocio, { empleados: ["ver", "crear", "editar"], servicios: ["ver", "editar"] });
    const jefe = await crearUsuario();
    await crearEmpleado(negocio, { usuario: jefe, rol: conServicios.id_rol });
    const ok = await api(await tokenDe(jefe)).patch(`/empleados/${otro.id_empleado}`).send({ servicios: [servicio.id_servicio] });
    expect(ok.status).toBe(200);
  });
});
