import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearCita, crearEmpleado, crearMascota, crearNegocio, crearRol, crearUsuario, tokenDe } from "../helpers/factories.js";

/** Notas del negocio sobre sus clientes (2.7): permisos, autoría y privacidad. */

const TEXTO = "Prefiere que lo llamen en la tarde";

/** Negocio con un cliente (cita) y un empleado Administrador con cuenta. */
const contexto = async () => {
  const negocio = await crearNegocio();
  const cliente = await crearUsuario({ nombre: "Laura", apellido: "Ríos" });
  const mascota = await crearMascota(cliente);
  const cita = await crearCita(negocio, { cliente, mascota });
  const admin = await crearUsuario({ nombre: "Ana", apellido: "Mora" });
  await crearEmpleado(negocio, { usuario: admin, rol: "Administrador" });
  return {
    negocio,
    cliente,
    mascota,
    cita,
    admin,
    url: `/negocios/${negocio.id_negocio}/clientes/${cliente.id_usuario}/notas`,
    propietario: api(await tokenDe(negocio.propietario)),
    panelAdmin: api(await tokenDe(admin)),
  };
};

describe("notas de clientes", () => {
  it("se crean con autor y fecha, se listan y salen en el detalle del cliente", async () => {
    const ctx = await contexto();
    const res = await ctx.panelAdmin.post(ctx.url).send({ texto: `  ${TEXTO}  ` });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      texto: TEXTO,
      autor: { id_usuario: ctx.admin.id_usuario, nombre: "Ana", apellido: "Mora" },
      fecha_edicion: null,
      editable: true,
      eliminable: true,
    });
    await ctx.propietario.post(ctx.url).send({ texto: "Trae siempre el carnet" });

    const lista = await ctx.propietario.get(ctx.url);
    expect(lista.body.data.map((n) => [n.texto, n.editable, n.eliminable])).toEqual([
      ["Trae siempre el carnet", true, true],
      [TEXTO, false, true], // el propietario borra notas ajenas, pero no las edita
    ]);
    expect(lista.body.meta.total).toBe(2);

    const detalle = await ctx.propietario.get(`/negocios/${ctx.negocio.id_negocio}/clientes/${ctx.cliente.id_usuario}`);
    expect(detalle.body.data.total_notas).toBe(2);
    expect(detalle.body.data.notas_recientes.map((n) => n.texto)).toEqual(["Trae siempre el carnet", TEXTO]);
  });

  it("permisos: leer con clientes.ver, escribir con clientes.editar; 404 si no es cliente del negocio", async () => {
    const ctx = await contexto();
    const recepcion = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: recepcion, rol: "Recepcionista" }); // clientes.ver, sin editar
    const panelRecepcion = api(await tokenDe(recepcion));
    expect((await panelRecepcion.get(ctx.url)).status).toBe(200);
    expect((await panelRecepcion.post(ctx.url).send({ texto: TEXTO })).status).toBe(403);

    const sinVer = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: sinVer, rol: (await crearRol(ctx.negocio, { citas: ["ver"] })).id_rol });
    expect((await api(await tokenDe(sinVer)).get(ctx.url)).status).toBe(403);

    const ajeno = await crearUsuario();
    const res = await ctx.propietario.post(`/negocios/${ctx.negocio.id_negocio}/clientes/${ajeno.id_usuario}/notas`).send({ texto: TEXTO });
    expect(res.status).toBe(404);
    expect((await ctx.propietario.post(ctx.url).send({ texto: "   " })).status).toBe(422);
    expect((await ctx.propietario.post(ctx.url).send({ texto: "x".repeat(1001) })).status).toBe(422);
  });

  it("editar solo el autor; borrar el autor o el propietario; el borrado es físico", async () => {
    const ctx = await contexto();
    const { id_nota } = (await ctx.panelAdmin.post(ctx.url).send({ texto: TEXTO })).body.data;
    const url = `/notas-cliente/${id_nota}`;

    const otroAdmin = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: otroAdmin, rol: "Administrador" });
    const panelOtro = api(await tokenDe(otroAdmin));
    expect((await panelOtro.patch(url).send({ texto: "Cambio" })).status).toBe(403);
    expect((await ctx.propietario.patch(url).send({ texto: "Cambio" })).status).toBe(403);
    expect((await panelOtro.delete(url)).status).toBe(403);

    const editada = await ctx.panelAdmin.patch(url).send({ texto: "Prefiere WhatsApp" });
    expect(editada.status).toBe(200);
    expect(editada.body.data.texto).toBe("Prefiere WhatsApp");
    expect(editada.body.data.fecha_edicion).not.toBeNull();

    expect((await ctx.propietario.delete(url)).status).toBe(200);
    const [filas] = await pool.query("SELECT 1 FROM notas_cliente WHERE id_nota = ?", [id_nota]);
    expect(filas).toEqual([]);
    expect((await ctx.panelAdmin.delete(url)).status).toBe(404);
  });

  it("el autor que ya no existe se muestra como null", async () => {
    const ctx = await contexto();
    const { id_nota } = (await ctx.panelAdmin.post(ctx.url).send({ texto: TEXTO })).body.data;
    await pool.query("UPDATE notas_cliente SET id_usuario_autor = NULL WHERE id_nota = ?", [id_nota]);
    const [nota] = (await ctx.propietario.get(ctx.url)).body.data;
    expect(nota).toMatchObject({ autor: null, editable: false, eliminable: true });
  });
});

describe("privacidad de las notas", () => {
  it("otro negocio no las ve ni las toca, aunque el usuario también sea su cliente", async () => {
    const ctx = await contexto();
    const { id_nota } = (await ctx.propietario.post(ctx.url).send({ texto: TEXTO })).body.data;

    const otro = await crearNegocio();
    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota });
    const panelOtro = api(await tokenDe(otro.propietario));
    const suyas = await panelOtro.get(`/negocios/${otro.id_negocio}/clientes/${ctx.cliente.id_usuario}/notas`);
    expect(suyas.body.data).toEqual([]);
    const detalle = await panelOtro.get(`/negocios/${otro.id_negocio}/clientes/${ctx.cliente.id_usuario}`);
    expect(detalle.body.data).toMatchObject({ notas_recientes: [], total_notas: 0 });

    // Recurso de otro negocio: 403 de authorize (convención), sin revelar el contenido.
    for (const res of [
      await panelOtro.patch(`/notas-cliente/${id_nota}`).send({ texto: "Hola" }),
      await panelOtro.delete(`/notas-cliente/${id_nota}`),
    ]) {
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(TEXTO);
    }
    const [[nota]] = await pool.query("SELECT texto FROM notas_cliente WHERE id_nota = ?", [id_nota]);
    expect(nota.texto).toBe(TEXTO);
    // Tampoco por la ruta del primer negocio.
    expect((await panelOtro.get(ctx.url)).status).toBe(403);
  });

  it("el cliente nunca las ve: no salen en sus citas, sus mascotas ni su perfil, y no puede leerlas", async () => {
    const ctx = await contexto();
    await ctx.propietario.post(ctx.url).send({ texto: TEXTO });
    const app = api(await tokenDe(ctx.cliente));

    for (const ruta of [
      "/citas/mias?alcance=todas",
      `/citas/${ctx.cita.id_cita}`,
      `/citas/${ctx.cita.id_cita}/historial`,
      "/mascotas",
      `/mascotas/${ctx.mascota.id_mascota}`,
      "/auth/me",
    ]) {
      const res = await app.get(ruta);
      expect(res.status, ruta).toBe(200);
      expect(JSON.stringify(res.body), ruta).not.toContain(TEXTO);
    }
    expect((await app.get(ctx.url)).status).toBe(403);
  });
});
