import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import { crearCita, crearMascota, crearNegocio, crearUsuario, tokenDe } from "../helpers/factories.js";

const diaRelativo = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

const conDueno = async (overrides = {}) => {
  const dueno = await crearUsuario();
  const mascota = await crearMascota(dueno, overrides);
  return { dueno, mascota, token: await tokenDe(dueno) };
};

const citaDe = async ({ dueno, mascota }, overrides = {}) =>
  crearCita(await crearNegocio(), { cliente: dueno, mascota, ...overrides });

describe("GET /mascotas", () => {
  it("lista solo las mascotas activas del usuario, con las fallecidas al final", async () => {
    const dueno = await crearUsuario();
    const viva = await crearMascota(dueno, { nombre: "Zeus" });
    const fallecida = await crearMascota(dueno, { nombre: "Abril", fallecido: true, fecha_fallecimiento: "2026-01-10" });
    await crearMascota(dueno, { nombre: "Borrada", activo: false });
    await crearMascota(await crearUsuario(), { nombre: "Ajena" });

    const res = await api(await tokenDe(dueno)).get("/mascotas");

    expect(res.status).toBe(200);
    expect(res.body.data.map((m) => m.id_mascota)).toEqual([viva.id_mascota, fallecida.id_mascota]);
    expect(res.body.data[1]).toMatchObject({ fallecido: true, fecha_fallecimiento: "2026-01-10" });
    expect(res.body.data[0]).not.toHaveProperty("activo");
  });

  it("sin token -> 401", async () => {
    expect((await api().get("/mascotas")).status).toBe(401);
  });
});

describe("POST /mascotas", () => {
  it("registra la mascota a nombre del usuario, con valores por defecto y edad calculada", async () => {
    const dueno = await crearUsuario();
    const res = await api(await tokenDe(dueno)).post("/mascotas").send({
      nombre: " Toby ",
      especie: "perro",
      raza: "Beagle",
      fecha_nacimiento: diaRelativo(-400),
      peso: 12.5,
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Mascota registrada");
    expect(res.body.data).toMatchObject({
      id_usuario: dueno.id_usuario,
      nombre: "Toby",
      especie: "perro",
      raza: "Beagle",
      sexo: "desconocido",
      peso: 12.5,
      edad_meses: 13,
      esterilizado: false,
      tiene_alergias: false,
      fallecido: false,
      fecha_fallecimiento: null,
      foto_url: null,
    });
  });

  it("no acepta dueño, foto, estado ni fallecimiento en el body -> 422", async () => {
    const token = await tokenDe(await crearUsuario());
    const res = await api(token)
      .post("/mascotas")
      .send({ nombre: "Toby", especie: "perro", id_usuario: 1, foto_url: "https://x.co/a.png", activo: false, fallecido: true });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      id_usuario: "Campo no permitido",
      foto_url: "Campo no permitido",
      activo: "Campo no permitido",
      fallecido: "Campo no permitido",
    });
  });

  it("valida obligatorios, especie, fecha futura y peso -> 422", async () => {
    const token = await tokenDe(await crearUsuario());
    const res = await api(token)
      .post("/mascotas")
      .send({ especie: "dinosaurio", fecha_nacimiento: diaRelativo(1), peso: 0, sexo: "x" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["especie", "fecha_nacimiento", "nombre", "peso", "sexo"]);
    expect(res.body.errors.fecha_nacimiento).toBe("No puede ser una fecha futura");

    const fecha = await api(token).post("/mascotas").send({ nombre: "A", especie: "gato", fecha_nacimiento: "2026-02-30" });
    expect(fecha.body.errors).toEqual({ fecha_nacimiento: "Fecha inválida: usa YYYY-MM-DD" });
  });
});

describe("GET /mascotas/:id_mascota", () => {
  it("devuelve la mascota propia", async () => {
    const { mascota, token } = await conDueno({ nombre: "Kira", especie: "gato" });
    const res = await api(token).get(`/mascotas/${mascota.id_mascota}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id_mascota: mascota.id_mascota, nombre: "Kira", especie: "gato" });
  });

  it("mascota de otro usuario -> 403; inexistente o eliminada -> 404; id inválido -> 422", async () => {
    const { mascota } = await conDueno();
    const borrada = await crearMascota(await crearUsuario(), { activo: false });
    const token = await tokenDe(await crearUsuario());

    const ajena = await api(token).get(`/mascotas/${mascota.id_mascota}`);
    expect(ajena.status).toBe(403);
    expect(ajena.body.message).toBe("No tienes acceso a esta mascota");
    expect((await api(token).get("/mascotas/999999999")).status).toBe(404);
    expect((await api(token).get(`/mascotas/${borrada.id_mascota}`)).status).toBe(404);
    expect((await api(token).get("/mascotas/abc")).status).toBe(422);
  });
});

describe("PATCH /mascotas/:id_mascota", () => {
  it("actualiza los campos enviados y vacía los opcionales con null", async () => {
    const { mascota, token } = await conDueno({ raza: "Criollo", peso: 10 });
    const res = await api(token)
      .patch(`/mascotas/${mascota.id_mascota}`)
      .send({ nombre: "Rocky", raza: null, esterilizado: true, tiene_alergias: true, alergias_detalle: "Pollo" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      nombre: "Rocky",
      raza: null,
      peso: 10,
      esterilizado: true,
      tiene_alergias: true,
      alergias_detalle: "Pollo",
    });
  });

  it("body vacío -> 422; mascota ajena -> 403", async () => {
    const { mascota, token } = await conDueno();
    const vacio = await api(token).patch(`/mascotas/${mascota.id_mascota}`).send({});
    expect(vacio.status).toBe(422);

    const otro = await tokenDe(await crearUsuario());
    expect((await api(otro).patch(`/mascotas/${mascota.id_mascota}`).send({ nombre: "X" })).status).toBe(403);
  });

  describe("fallecimiento", () => {
    it("fallecido: true sin fecha usa hoy; fallecido: false borra la fecha", async () => {
      const { mascota, token } = await conDueno();
      const marcar = await api(token).patch(`/mascotas/${mascota.id_mascota}`).send({ fallecido: true });
      expect(marcar.status).toBe(200);
      expect(marcar.body.data).toMatchObject({ fallecido: true, fecha_fallecimiento: hoyISO() });

      const desmarcar = await api(token).patch(`/mascotas/${mascota.id_mascota}`).send({ fallecido: false });
      expect(desmarcar.body.data).toMatchObject({ fallecido: false, fecha_fallecimiento: null });
    });

    it("con fecha: no anterior al nacimiento; solo la fecha exige estar fallecida", async () => {
      const { mascota, token } = await conDueno({ fecha_nacimiento: "2024-05-01" });
      const url = `/mascotas/${mascota.id_mascota}`;

      const antes = await api(token).patch(url).send({ fallecido: true, fecha_fallecimiento: "2024-04-30" });
      expect(antes.status).toBe(422);
      expect(antes.body.errors).toEqual({ fecha_fallecimiento: "No puede ser anterior a la fecha de nacimiento" });

      const soloFecha = await api(token).patch(url).send({ fecha_fallecimiento: "2026-01-01" });
      expect(soloFecha.status).toBe(422);

      const ok = await api(token).patch(url).send({ fallecido: true, fecha_fallecimiento: "2026-01-01" });
      expect(ok.body.data.fecha_fallecimiento).toBe("2026-01-01");

      const corregir = await api(token).patch(url).send({ fecha_fallecimiento: "2026-01-02" });
      expect(corregir.body.data.fecha_fallecimiento).toBe("2026-01-02");

      const nacimiento = await api(token).patch(url).send({ fecha_nacimiento: "2026-02-01" });
      expect(nacimiento.status).toBe(422);

      const vaciar = await api(token).patch(url).send({ fecha_fallecimiento: null });
      expect(vaciar.status).toBe(422);

      const falseConFecha = await api(token).patch(url).send({ fallecido: false, fecha_fallecimiento: "2026-01-01" });
      expect(falseConFecha.status).toBe(422);
    });

    it("con citas futuras pendientes o confirmadas -> 409; canceladas o pasadas no cuentan", async () => {
      const conFutura = await conDueno();
      await citaDe(conFutura, { estado: "confirmada" });
      const res = await api(conFutura.token).patch(`/mascotas/${conFutura.mascota.id_mascota}`).send({ fallecido: true });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "La mascota tiene citas pendientes o confirmadas: cancélalas antes de registrar el fallecimiento"
      );

      const sinFuturas = await conDueno();
      await citaDe(sinFuturas, { estado: "cancelada" });
      await citaDe(sinFuturas, { estado: "pendiente", fecha: diaRelativo(-1) });
      const ok = await api(sinFuturas.token).patch(`/mascotas/${sinFuturas.mascota.id_mascota}`).send({ fallecido: true });
      expect(ok.status).toBe(200);
    });
  });
});

describe("DELETE /mascotas/:id_mascota", () => {
  it("borrado lógico: después 404 y no aparece en la lista, pero la fila y sus citas siguen", async () => {
    const contexto = await conDueno();
    const { mascota, token } = contexto;
    await citaDe(contexto, { estado: "completada", fecha: diaRelativo(-10) });

    const res = await api(token).delete(`/mascotas/${mascota.id_mascota}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Mascota eliminada", data: null });
    expect((await api(token).get(`/mascotas/${mascota.id_mascota}`)).status).toBe(404);
    expect((await api(token).get("/mascotas")).body.data).toEqual([]);
    const [[fila]] = await pool.query("SELECT activo FROM mascotas WHERE id_mascota = ?", [mascota.id_mascota]);
    expect(fila.activo).toBe(0);
    const [citas] = await pool.query("SELECT id_cita FROM citas WHERE id_mascota = ?", [mascota.id_mascota]);
    expect(citas).toHaveLength(1);
  });

  it("con una cita futura pendiente -> 409", async () => {
    const contexto = await conDueno();
    await citaDe(contexto, { estado: "pendiente" });
    const res = await api(contexto.token).delete(`/mascotas/${contexto.mascota.id_mascota}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("La mascota tiene citas pendientes o confirmadas: cancélalas antes de eliminarla");
  });

  it("mascota ajena -> 403; ya eliminada -> 404", async () => {
    const { mascota, token } = await conDueno();
    expect((await api(await tokenDe(await crearUsuario())).delete(`/mascotas/${mascota.id_mascota}`)).status).toBe(403);
    expect((await api(token).delete(`/mascotas/${mascota.id_mascota}`)).status).toBe(200);
    expect((await api(token).delete(`/mascotas/${mascota.id_mascota}`)).status).toBe(404);
  });
});
