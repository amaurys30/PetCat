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

  it("valida la mascota y exige el email; email existente -> 409 y no crea nada", async () => {
    const { negocio, token } = await contexto();
    const url = `/negocios/${negocio.id_negocio}/clientes`;
    const invalido = await api(token).post(url).send(datosCliente({ email: undefined, mascota: { nombre: "X" } }));
    expect(invalido.status).toBe(422);
    expect(invalido.body.errors).toEqual({ email: "Campo obligatorio", "mascota.especie": "Campo obligatorio" });

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
