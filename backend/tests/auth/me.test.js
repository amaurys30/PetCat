import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearNegocio, crearUsuario, tokenDe } from "../helpers/factories.js";

const telefonoVerificado = async (id_usuario) => {
  const [[row]] = await pool.query("SELECT telefono_verificado FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return Boolean(row.telefono_verificado);
};

describe("GET /auth/me", () => {
  it("sin token -> 401", async () => {
    expect((await api().get("/auth/me")).status).toBe(401);
  });

  it("devuelve perfil, preferencias y negocios propios y como empleado, sin datos sensibles", async () => {
    const usuario = await crearUsuario({ telefono: "3001112233" });
    const propio = await crearNegocio(usuario);
    const ajeno = await crearNegocio();
    const empleado = await crearEmpleado(ajeno, { usuario, rol: "Recepcionista" });

    const res = await api(await tokenDe(usuario)).get("/auth/me");

    expect(res.status).toBe(200);
    const { negocios, ...perfil } = res.body.data;
    expect(perfil).toEqual({
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: "3001112233",
      foto_url: null,
      tipo_usuario: "cliente",
      email_verificado: false,
      telefono_verificado: false,
      idioma: "es",
      zona_horaria: "America/Bogota",
      notif_email: true,
      notif_push: true,
      notif_whatsapp: true,
      ultimo_acceso: null,
      fecha_registro: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
      requiere_aceptar_politica: true,
    });
    expect(negocios).toHaveLength(2);
    expect(negocios.find((n) => n.id_negocio === propio.id_negocio)).toMatchObject({ relacion: "propietario", rol: null });
    expect(negocios.find((n) => n.id_negocio === ajeno.id_negocio)).toMatchObject({
      relacion: "empleado",
      id_empleado: empleado.id_empleado,
      rol: { nombre: "Recepcionista" },
    });
  });
});

describe("PATCH /auth/me", () => {
  it("actualiza los campos enviados y devuelve el perfil", async () => {
    const usuario = await crearUsuario();
    const res = await api(await tokenDe(usuario)).patch("/auth/me").send({
      nombre: "  Camila ",
      idioma: "en",
      zona_horaria: "America/New_York",
      notif_whatsapp: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Perfil actualizado");
    expect(res.body.data).toMatchObject({
      nombre: "Camila",
      apellido: usuario.apellido,
      idioma: "en",
      zona_horaria: "America/New_York",
      notif_email: true,
      notif_whatsapp: false,
    });
    expect(res.body.data).not.toHaveProperty("negocios");
  });

  it("cambiar el teléfono lo deja sin verificar; enviar el mismo no", async () => {
    const usuario = await crearUsuario({ telefono: "3001112233", telefono_verificado: true });
    const token = await tokenDe(usuario);

    await api(token).patch("/auth/me").send({ telefono: "3001112233" });
    expect(await telefonoVerificado(usuario.id_usuario)).toBe(true);

    const res = await api(token).patch("/auth/me").send({ telefono: "3009998877" });
    expect(res.body.data).toMatchObject({ telefono: "3009998877", telefono_verificado: false });
    expect(await telefonoVerificado(usuario.id_usuario)).toBe(false);
  });

  it("el teléfono se vacía con null", async () => {
    const usuario = await crearUsuario({ telefono: "3001112233" });
    const res = await api(await tokenDe(usuario)).patch("/auth/me").send({ telefono: null });
    expect(res.status).toBe(200);
    expect(res.body.data.telefono).toBeNull();
  });

  it("no permite cambiar email, tipo_usuario ni email_verificado -> 422", async () => {
    const usuario = await crearUsuario();
    const res = await api(await tokenDe(usuario))
      .patch("/auth/me")
      .send({ email: "otro@petcat.test", tipo_usuario: "admin", email_verificado: true });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      email: "Campo no permitido",
      tipo_usuario: "Campo no permitido",
      email_verificado: "Campo no permitido",
    });
  });

  it("body vacío o valores inválidos -> 422", async () => {
    const token = await tokenDe(await crearUsuario());
    const vacio = await api(token).patch("/auth/me").send({});
    expect(vacio.status).toBe(422);
    expect(vacio.body.errors).toEqual({ _: "Envía al menos un campo para actualizar" });

    const invalido = await api(token)
      .patch("/auth/me")
      .send({ idioma: "fr", zona_horaria: "Marte/Olympus", notif_push: "si", nombre: "A" });
    expect(invalido.status).toBe(422);
    expect(Object.keys(invalido.body.errors).sort()).toEqual(["idioma", "nombre", "notif_push", "zona_horaria"]);
  });

  it("sin token -> 401", async () => {
    expect((await api().patch("/auth/me").send({ nombre: "Ana" })).status).toBe(401);
  });
});

describe("política de datos de cuentas existentes", () => {
  const autorizaciones = async (id_usuario) => {
    const [rows] = await pool.query(
      "SELECT canal, id_usuario_registro, version_politica, ip_address FROM autorizaciones_datos WHERE id_usuario = ?",
      [id_usuario]
    );
    return rows;
  };

  it("sin autorización vigente, /me pide aceptarla; al aceptarla se guarda (canal aceptacion) y deja de pedirla", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    expect((await api(token).get("/auth/me")).body.data.requiere_aceptar_politica).toBe(true);

    const res = await api(token).post("/auth/politica-datos/aceptar").send({ acepta_politica_datos: true });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Política de datos aceptada");
    expect(res.body.data).toMatchObject({ canal: "aceptacion", version_politica: "1.0" });
    expect(await autorizaciones(usuario.id_usuario)).toEqual([
      { canal: "aceptacion", id_usuario_registro: usuario.id_usuario, version_politica: "1.0", ip_address: expect.any(String) },
    ]);
    expect((await api(token).get("/auth/me")).body.data.requiere_aceptar_politica).toBe(false);

    const otraVez = await api(token).post("/auth/politica-datos/aceptar").send({ acepta_politica_datos: true });
    expect(otraVez.status).toBe(200);
    expect(otraVez.body.message).toBe("Ya habías aceptado esta versión de la política");
    expect(await autorizaciones(usuario.id_usuario)).toHaveLength(1);
  });

  it("una autorización de otra versión o revocada no cuenta", async () => {
    const usuario = await crearUsuario();
    await pool.query(
      `INSERT INTO autorizaciones_datos (id_usuario, canal, version_politica, revocada_en)
       VALUES (?, 'app', '0.9', NULL), (?, 'app', '1.0', NOW())`,
      [usuario.id_usuario, usuario.id_usuario]
    );
    expect((await api(await tokenDe(usuario)).get("/auth/me")).body.data.requiere_aceptar_politica).toBe(true);
  });

  it("acepta_politica_datos debe ser true -> 422; sin token -> 401", async () => {
    const token = await tokenDe(await crearUsuario());
    const res = await api(token).post("/auth/politica-datos/aceptar").send({ acepta_politica_datos: false });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      acepta_politica_datos: "Debes aceptar la política de tratamiento de datos (Ley 1581 de 2012)",
    });
    expect((await api().post("/auth/politica-datos/aceptar").send({ acepta_politica_datos: true })).status).toBe(401);
  });

  it("los usuarios del seed ya tienen la autorización vigente", async () => {
    const login = await api().post("/auth/login").send({ email: "cliente@petcat.test", password: "Petcat123!" });
    expect((await api(login.body.data.access_token).get("/auth/me")).body.data.requiere_aceptar_politica).toBe(false);
  });
});
