import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { outbox, clearOutbox } from "../../src/shared/utils/mailer.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearMascota,
  crearNegocio,
  crearRol,
  crearUsuario,
  tokenDe,
  unique,
} from "../helpers/factories.js";

const contexto = async () => {
  const negocio = await crearNegocio(null, { nombre: `Clínica ${unique()}` });
  return { negocio, token: await tokenDe(negocio.propietario) };
};

const tokenDelCorreo = (mail) => /\/crear-password\/([0-9a-f]{64})/.exec(mail.text)?.[1];

const datosCliente = (overrides = {}) => ({
  nombre: "Rosa",
  apellido: "Pérez",
  email: `cliente_${unique()}@petcat.test`,
  telefono: "300 111 2233",
  autoriza_tratamiento_datos: true,
  mascota: { nombre: "Canela", especie: "perro", raza: "Criolla" },
  ...overrides,
});

beforeEach(() => clearOutbox());

describe("GET /negocios/:id_negocio/clientes/buscar", () => {
  it("encuentra por email exacto (sin mayúsculas) con sus mascotas activas y vivas", async () => {
    const { negocio, token } = await contexto();
    const cliente = await crearUsuario({ telefono: "3001234567" });
    const viva = await crearMascota(cliente, { nombre: "Bruno" });
    await crearMascota(cliente, { nombre: "Eliminada", activo: false });
    await crearMascota(cliente, { nombre: "Fallecida", fallecido: true, fecha_fallecimiento: "2026-01-01" });

    const res = await api(token).get(
      `/negocios/${negocio.id_negocio}/clientes/buscar?email=${encodeURIComponent(cliente.email.toUpperCase())}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id_usuario: cliente.id_usuario,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        telefono: "3001234567",
        usa_app: false,
        mascotas: [{ id_mascota: viva.id_mascota, nombre: "Bruno", especie: "perro", raza: null }],
      },
    ]);
  });

  it("por teléfono compara solo los dígitos; sin coincidencia exacta, lista vacía", async () => {
    const { negocio, token } = await contexto();
    const telefono = `31${String(Date.now()).slice(-8)}`;
    const cliente = await crearUsuario({ telefono: `${telefono.slice(0, 3)} ${telefono.slice(3, 6)} ${telefono.slice(6)}` });
    await crearUsuario({ telefono, activo: false });
    const url = `/negocios/${negocio.id_negocio}/clientes/buscar`;

    const res = await api(token).get(`${url}?telefono=${telefono}`);
    expect(res.body.data.map((c) => c.id_usuario)).toEqual([cliente.id_usuario]);
    expect((await api(token).get(`${url}?telefono=${telefono.slice(0, -1)}`)).body.data).toEqual([]);
  });

  it("exige email o teléfono, solo uno -> 422; sin citas.crear ni clientes.ver -> 403", async () => {
    const { negocio, token } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/clientes/buscar`;
    expect((await api(token).get(url)).status).toBe(422);
    expect((await api(token).get(`${url}?email=a@b.co&telefono=3001112233`)).body.errors).toEqual({
      _: "Envía email o telefono (solo uno)",
    });
    expect((await api(token).get(`${url}?telefono=12`)).body.errors).toEqual({ telefono: "Teléfono inválido" });

    const usuario = await crearUsuario();
    await crearEmpleado(negocio, { usuario, rol: (await crearRol(negocio, { inventario: ["ver"] })).id_rol });
    expect((await api(await tokenDe(usuario)).get(`${url}?email=a@b.co`)).status).toBe(403);
  });
});

describe("POST /negocios/:id_negocio/clientes", () => {
  it("crea cliente, mascota y autorización de datos, y envía la bienvenida con el enlace de 7 días", async () => {
    const { negocio, token } = await contexto();
    const datos = datosCliente();

    const res = await api(token).post(`/negocios/${negocio.id_negocio}/clientes`).send(datos);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Cliente registrado. Le enviamos un correo para que cree su contraseña");
    const { cliente, mascota } = res.body.data;
    expect(cliente).toEqual({
      id_usuario: expect.any(Number),
      nombre: "Rosa",
      apellido: "Pérez",
      email: datos.email,
      telefono: "300 111 2233",
    });
    expect(mascota).toMatchObject({ id_usuario: cliente.id_usuario, nombre: "Canela", especie: "perro" });

    const [[usuario]] = await pool.query(
      `SELECT tipo_usuario, email_verificado, token_recuperacion,
              TIMESTAMPDIFF(HOUR, NOW(), token_recuperacion_expira) AS horas
       FROM usuarios WHERE id_usuario = ?`,
      [cliente.id_usuario]
    );
    expect(usuario).toMatchObject({ tipo_usuario: "cliente", email_verificado: 0 });
    expect(usuario.horas).toBeGreaterThanOrEqual(167);

    const [autorizaciones] = await pool.query(
      "SELECT canal, id_negocio, id_usuario_registro, version_politica FROM autorizaciones_datos WHERE id_usuario = ?",
      [cliente.id_usuario]
    );
    expect(autorizaciones).toEqual([
      { canal: "panel", id_negocio: negocio.id_negocio, id_usuario_registro: negocio.propietario.id_usuario, version_politica: "1.0" },
    ]);

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: datos.email, subject: `${negocio.nombre} te registró en PetCat` });
    expect(outbox[0].text).toContain("El enlace vence en 7 días");
    const enlace = tokenDelCorreo(outbox[0]);
    expect(usuario.token_recuperacion).toBe(hashToken(enlace));

    // El enlace crea la contraseña con el flujo de restablecer y verifica el email.
    const crear = await api().post("/auth/reset-password").send({ token: enlace, password: "MiClave2026" });
    expect(crear.status).toBe(200);
    const login = await api().post("/auth/login").send({ email: datos.email, password: "MiClave2026" });
    expect(login.status).toBe(200);
    expect(login.body.data.usuario.email_verificado).toBe(true);
  });

  it("sin la autorización de datos (o distinta de true) -> 422", async () => {
    const { negocio, token } = await contexto();
    for (const autoriza_tratamiento_datos of [undefined, false]) {
      const res = await api(token)
        .post(`/negocios/${negocio.id_negocio}/clientes`)
        .send(datosCliente({ autoriza_tratamiento_datos }));
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({
        autoriza_tratamiento_datos: "Se requiere la autorización del titular para el tratamiento de sus datos (Ley 1581 de 2012)",
      });
    }
  });

  it("valida la mascota; sin correo ni teléfono -> 422; email existente -> 409 y no crea nada", async () => {
    const { negocio, token } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/clientes`;
    const invalido = await api(token).post(url).send(datosCliente({ mascota: { nombre: "X" } }));
    expect(invalido.status).toBe(422);
    expect(invalido.body.errors).toEqual({ "mascota.especie": "Campo obligatorio" });
    const sinContacto = await api(token).post(url).send(datosCliente({ email: undefined, telefono: undefined }));
    expect(sinContacto.status).toBe(422);
    expect(sinContacto.body.errors).toEqual({ telefono: "Obligatorio si el cliente no tiene correo" });

    const existente = await crearUsuario();
    const res = await api(token).post(url).send(datosCliente({ email: existente.email }));
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Ya existe una cuenta con ese correo: búscala con clientes/buscar");
    expect(outbox).toHaveLength(0);
  });

  it("el cliente que registró el negocio tiene relación con él: se le puede agregar otra mascota", async () => {
    const { negocio, token } = await contexto();
    const { cliente } = (await api(token).post(`/negocios/${negocio.id_negocio}/clientes`).send(datosCliente())).body.data;
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/clientes/${cliente.id_usuario}/mascotas`)
      .send({ nombre: "Michi", especie: "gato" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id_usuario: cliente.id_usuario, nombre: "Michi", especie: "gato" });
  });

  it("recepcionista (citas.crear) puede registrar; quien no tiene citas.crear -> 403", async () => {
    const { negocio } = await contexto();
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    const vetSinCrear = await crearUsuario();
    await crearEmpleado(negocio, { usuario: vetSinCrear, rol: (await crearRol(negocio, { citas: ["ver"] })).id_rol });
    const url = `/negocios/${negocio.id_negocio}/clientes`;

    expect((await api(await tokenDe(recepcion)).post(url).send(datosCliente())).status).toBe(201);
    expect((await api(await tokenDe(vetSinCrear)).post(url).send(datosCliente())).status).toBe(403);
  });
});

describe("POST /negocios/:id_negocio/clientes/:id_usuario/mascotas", () => {
  it("con una cita con el negocio se puede; sin relación -> 403; cliente inexistente -> 404", async () => {
    const { negocio, token } = await contexto();
    const conCita = await crearUsuario();
    await crearCita(negocio, { cliente: conCita, estado: "cancelada" });
    const sinRelacion = await crearUsuario();
    const url = (id) => `/negocios/${negocio.id_negocio}/clientes/${id}/mascotas`;
    const mascota = { nombre: "Lola", especie: "conejo" };

    expect((await api(token).post(url(conCita.id_usuario)).send(mascota)).status).toBe(201);

    const res = await api(token).post(url(sinRelacion.id_usuario)).send(mascota);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Este cliente no tiene relación con el negocio: solo el dueño puede registrar sus mascotas desde la app"
    );
    expect((await api(token).post(url(999999999)).send(mascota)).status).toBe(404);
  });

  it("una autorización registrada por otro negocio no cuenta como relación", async () => {
    const otro = await contexto();
    const { cliente } = (await api(otro.token).post(`/negocios/${otro.negocio.id_negocio}/clientes`).send(datosCliente())).body
      .data;
    const { negocio, token } = await contexto();
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/clientes/${cliente.id_usuario}/mascotas`)
      .send({ nombre: "Lola", especie: "conejo" });
    expect(res.status).toBe(403);
  });
});

describe("clientes sin cuenta (registrados sin correo)", () => {
  const telefonoUnico = () => `31${String(Date.now()).slice(-8)}`;

  it("se registran con teléfono, sin bienvenida; la búsqueda por teléfono los encuentra y no se duplican", async () => {
    const { negocio, token } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/clientes`;
    const telefono = telefonoUnico();
    const res = await api(token).post(url).send(datosCliente({ email: undefined, telefono }));

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      "Cliente registrado sin cuenta: no recibirá correos ni recordatorios y no podrá entrar a la app"
    );
    expect(res.body.data).toMatchObject({ sin_cuenta: true, cliente: { email: null, telefono } });
    expect(outbox).toHaveLength(0);
    const [[usuario]] = await pool.query("SELECT email, token_recuperacion FROM usuarios WHERE id_usuario = ?", [
      res.body.data.cliente.id_usuario,
    ]);
    expect(usuario).toEqual({ email: null, token_recuperacion: null });
    const [[autorizacion]] = await pool.query("SELECT canal, id_negocio FROM autorizaciones_datos WHERE id_usuario = ?", [
      res.body.data.cliente.id_usuario,
    ]);
    expect(autorizacion).toEqual({ canal: "panel", id_negocio: negocio.id_negocio });

    const encontrado = await api(token).get(`${url}/buscar?telefono=${telefono}`);
    expect(encontrado.body.data).toEqual([
      expect.objectContaining({ id_usuario: res.body.data.cliente.id_usuario, email: null, usa_app: false }),
    ]);

    const otra = await api(token).post(url).send(datosCliente({ email: undefined, telefono: `${telefono.slice(0, 3)} ${telefono.slice(3)}` }));
    expect(otra.status).toBe(409);
    expect(otra.body.errors).toEqual({ telefono: "Ya hay un cliente con este teléfono" });
    expect(otra.body.message).toMatch(/misma familia.*agrégale la mascota/);

    // El teléfono de alguien que no es cliente de este negocio no lo impide: no podría agregarle mascotas.
    const ajeno = telefonoUnico().replace(/^31/, "32");
    await crearUsuario({ telefono: ajeno });
    expect((await api(token).post(url).send(datosCliente({ email: undefined, telefono: ajeno }))).status).toBe(201);
  });

  it("no pueden iniciar sesión ni recuperar la contraseña, y las citas no les envían correo", async () => {
    const { negocio, token } = await contexto();
    const sucursal = await pool
      .query("INSERT INTO sucursales (id_negocio, nombre, direccion) VALUES (?, 'Sede', 'Calle 1')", [negocio.id_negocio])
      .then(([r]) => r.insertId);
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/clientes`)
      .send(datosCliente({ email: undefined, telefono: telefonoUnico() }));
    const { id_usuario } = res.body.data.cliente;

    // Login y recuperación son por correo: no hay con qué entrar y la respuesta es la neutra.
    expect((await api().post("/auth/login").send({ email: "", password: "x" })).status).toBe(422);
    const recuperar = await api().post("/auth/forgot-password").send({ email: `nadie_${unique()}@petcat.test` });
    expect(recuperar.status).toBe(200);

    // Una notificación al dueño (cita agendada desde el panel) queda en la app, sin envío por correo.
    const { conNotificaciones } = await import("../../src/modules/notificaciones/notificacion.service.js");
    clearOutbox();
    await conNotificaciones((conn, notificar) =>
      notificar([
        {
          tipo: "cita_agendada",
          id_negocio: negocio.id_negocio,
          datos: { fecha: "2026-12-01", hora_inicio: "09:00", negocio: negocio.nombre, sucursal: "Sede", direccion: "Calle 1", mascota: "Canela", servicio: "Consulta", cliente: "Rosa Pérez" },
          enlace: { id_negocio: negocio.id_negocio },
          destinatarios: [{ id_usuario, rol: "dueno" }],
        },
      ])
    );
    const [envios] = await pool.query(
      "SELECT e.canal FROM notificaciones_envios e JOIN notificaciones n ON n.id_notificacion = e.id_notificacion WHERE n.id_usuario = ?",
      [id_usuario]
    );
    expect(envios).toEqual([]);
    expect(outbox).toHaveLength(0);
    expect(sucursal).toBeGreaterThan(0);
  });
});

describe("PUT /negocios/:id_negocio/clientes/:id_usuario/correo", () => {
  const telefonoUnico = () => `31${String(Date.now()).slice(-8)}`;
  const sinCuenta = async (ctx) => {
    const res = await api(ctx.token)
      .post(`/negocios/${ctx.negocio.id_negocio}/clientes`)
      .send(datosCliente({ email: undefined, telefono: telefonoUnico() }));
    return res.body.data.cliente;
  };
  const ponerCorreo = (ctx, id_usuario, email, token = ctx.token) =>
    api(token).put(`/negocios/${ctx.negocio.id_negocio}/clientes/${id_usuario}/correo`).send({ email });
  const detalle = (ctx, id_usuario) => api(ctx.token).get(`/negocios/${ctx.negocio.id_negocio}/clientes/${id_usuario}`);

  it("agrega el correo a un cliente sin cuenta, envía la bienvenida y con ella activa su cuenta", async () => {
    const ctx = await contexto();
    const cliente = await sinCuenta(ctx);
    expect((await detalle(ctx, cliente.id_usuario)).body.data.cliente.correo_editable).toBe(true);
    const email = `nuevo_${unique()}@petcat.test`;

    const res = await ponerCorreo(ctx, cliente.id_usuario, email.toUpperCase());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Correo agregado. Le enviamos la bienvenida para que active su cuenta");
    expect(res.body.data).toEqual({ accion: "agregado", cliente: { ...cliente, email } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: email, subject: `${ctx.negocio.nombre} te registró en PetCat` });

    const enlace = tokenDelCorreo(outbox[0]);
    expect((await api().post("/auth/reset-password").send({ token: enlace, password: "MiClave2026" })).status).toBe(200);
    const login = await api().post("/auth/login").send({ email, password: "MiClave2026" });
    expect(login.status).toBe(200);

    // Activada la cuenta, el negocio ya no puede cambiar el correo.
    expect((await detalle(ctx, cliente.id_usuario)).body.data.cliente).toMatchObject({ usa_app: true, correo_editable: false });
    const otra = await ponerCorreo(ctx, cliente.id_usuario, `otro_${unique()}@petcat.test`);
    expect(otra.status).toBe(409);
    expect(otra.body.message).toBe("El cliente ya activó su cuenta: solo él puede cambiar su correo desde la app");
  });

  it("corregir el correo invalida el enlace anterior; el mismo correo reenvía con un minuto de espera", async () => {
    const ctx = await contexto();
    const registro = await api(ctx.token).post(`/negocios/${ctx.negocio.id_negocio}/clientes`).send(datosCliente());
    const { id_usuario } = registro.body.data.cliente;
    const enlaceViejo = tokenDelCorreo(outbox[0]);
    clearOutbox();
    const correcto = `corregido_${unique()}@petcat.test`;

    const res = await ponerCorreo(ctx, id_usuario, correcto);
    expect(res.status).toBe(200);
    expect(res.body.data.accion).toBe("corregido");
    expect(res.body.message).toBe("Correo corregido. Le enviamos una bienvenida nueva; el enlace anterior ya no sirve");
    expect(outbox.map((m) => m.to)).toEqual([correcto]);
    const enlaceNuevo = tokenDelCorreo(outbox[0]);

    const viejo = await api().post("/auth/reset-password").send({ token: enlaceViejo, password: "MiClave2026" });
    expect(viejo.status).toBe(400);

    // Reenviar al mismo correo enseguida: 429 y el enlace vigente sigue sirviendo.
    const reenvio = await ponerCorreo(ctx, id_usuario, correcto);
    expect(reenvio.status).toBe(429);
    await pool.query("UPDATE usuarios SET token_recuperacion_expira = token_recuperacion_expira - INTERVAL 2 MINUTE WHERE id_usuario = ?", [
      id_usuario,
    ]);
    clearOutbox();
    const otraVez = await ponerCorreo(ctx, id_usuario, correcto);
    expect(otraVez.status).toBe(200);
    expect(otraVez.body).toMatchObject({ message: "Le reenviamos la bienvenida", data: { accion: "reenviado" } });
    expect(outbox).toHaveLength(1);
    expect((await api().post("/auth/reset-password").send({ token: enlaceNuevo, password: "MiClave2026" })).status).toBe(400);
    expect((await api().post("/auth/reset-password").send({ token: tokenDelCorreo(outbox[0]), password: "MiClave2026" })).status).toBe(200);
  });

  it("correo de otra cuenta -> 409; otro negocio no corrige un correo que no registró -> 403; no cliente -> 404", async () => {
    const ctx = await contexto();
    const cliente = await sinCuenta(ctx);
    const ajeno = await crearUsuario();
    const dup = await ponerCorreo(ctx, cliente.id_usuario, ajeno.email);
    expect(dup.status).toBe(409);
    expect(dup.body.errors).toEqual({ email: "Ya está registrado" });

    // Cliente con correo registrado por la clínica, que también tiene una cita en otro negocio.
    const registro = await api(ctx.token).post(`/negocios/${ctx.negocio.id_negocio}/clientes`).send(datosCliente());
    const otro = await contexto();
    const id_usuario = registro.body.data.cliente.id_usuario;
    const [[mascota]] = await pool.query("SELECT id_mascota FROM mascotas WHERE id_usuario = ?", [id_usuario]);
    await crearCita(otro.negocio, { cliente: { id_usuario }, mascota });
    expect((await api(otro.token).get(`/negocios/${otro.negocio.id_negocio}/clientes/${id_usuario}`)).body.data.cliente.correo_editable).toBe(false);
    expect((await ponerCorreo(otro, id_usuario, `x_${unique()}@petcat.test`)).status).toBe(403);

    expect((await ponerCorreo(otro, ajeno.id_usuario, `y_${unique()}@petcat.test`)).status).toBe(404);
  });

  it("acepta citas.crear o clientes.editar; con otro permiso -> 403", async () => {
    const ctx = await contexto();
    const conRol = async (permisos) => {
      const usuario = await crearUsuario();
      await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, permisos)).id_rol });
      return tokenDe(usuario);
    };
    const a = await sinCuenta(ctx);
    expect((await ponerCorreo(ctx, a.id_usuario, `a_${unique()}@petcat.test`, await conRol({ citas: ["crear"] }))).status).toBe(200);
    const b = await sinCuenta(ctx);
    expect((await ponerCorreo(ctx, b.id_usuario, `b_${unique()}@petcat.test`, await conRol({ clientes: ["editar"] }))).status).toBe(200);
    const c = await sinCuenta(ctx);
    expect((await ponerCorreo(ctx, c.id_usuario, `c_${unique()}@petcat.test`, await conRol({ clientes: ["ver"] }))).status).toBe(403);
  });
});
