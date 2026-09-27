import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearEmpleado,
  crearHorarios,
  crearNegocio,
  crearRol,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const sucursalConToken = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio, { es_principal: true });
  return { negocio, sucursal, token: await tokenDe(negocio.propietario) };
};

const rango = (dia_semana, hora_apertura, hora_cierre) => ({ dia_semana, hora_apertura, hora_cierre });

describe("GET /sucursales/:id_sucursal/horarios", () => {
  it("público: devuelve los rangos ordenados, con horario partido", async () => {
    const { sucursal } = await sucursalConToken();
    await crearHorarios(sucursal, [
      [2, "14:00", "18:00"],
      [1, "08:00", "12:00"],
      [2, "08:00", "12:00"],
    ]);

    const res = await api().get(`/sucursales/${sucursal.id_sucursal}/horarios`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(({ id_horario, ...r }) => r)).toEqual([
      rango(1, "08:00", "12:00"),
      rango(2, "08:00", "12:00"),
      rango(2, "14:00", "18:00"),
    ]);
  });

  it("404 si la sucursal está inactiva o no existe; 422 si el id no es válido", async () => {
    const inactiva = await crearSucursal(await crearNegocio(), { activo: false });
    expect((await api().get(`/sucursales/${inactiva.id_sucursal}/horarios`)).status).toBe(404);
    expect((await api().get("/sucursales/999999/horarios")).status).toBe(404);
    expect((await api().get("/sucursales/x/horarios")).status).toBe(422);
  });
});

describe("PUT /sucursales/:id_sucursal/horarios", () => {
  it("reemplaza la semana completa con varios rangos por día", async () => {
    const { sucursal, token } = await sucursalConToken();
    await crearHorarios(sucursal, [[0, "09:00", "13:00"]]);

    const semana = [
      rango(1, "08:00", "12:00"),
      rango(1, "14:00:00", "18:00"),
      rango(6, "08:00", "12:00"),
    ];
    const res = await api(token).put(`/sucursales/${sucursal.id_sucursal}/horarios`).send({ horarios: semana });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Horarios actualizados");
    expect(res.body.data.citas_afectadas).toEqual([]);
    expect(res.body.data.horarios.map(({ id_horario, ...r }) => r)).toEqual([
      rango(1, "08:00", "12:00"),
      rango(1, "14:00", "18:00"),
      rango(6, "08:00", "12:00"),
    ]);

    // El domingo que existía ya no está.
    const [filas] = await pool.query("SELECT dia_semana FROM horarios_negocio WHERE id_sucursal = ?", [sucursal.id_sucursal]);
    expect(filas.map((f) => f.dia_semana).sort()).toEqual([1, 1, 6]);
  });

  it("rangos que se tocan están permitidos; una lista vacía cierra toda la semana", async () => {
    const { sucursal, token } = await sucursalConToken();
    const contiguos = await api(token)
      .put(`/sucursales/${sucursal.id_sucursal}/horarios`)
      .send({ horarios: [rango(3, "08:00", "12:00"), rango(3, "12:00", "14:00")] });
    expect(contiguos.status).toBe(200);

    const vacia = await api(token).put(`/sucursales/${sucursal.id_sucursal}/horarios`).send({ horarios: [] });
    expect(vacia.status).toBe(200);
    expect(vacia.body.data).toEqual({ horarios: [], citas_afectadas: [] });
  });

  it("rangos que se cruzan el mismo día -> 422 indicando el rango, sin tocar lo guardado", async () => {
    const { sucursal, token } = await sucursalConToken();
    await crearHorarios(sucursal, [[5, "10:00", "11:00"]]);

    const res = await api(token)
      .put(`/sucursales/${sucursal.id_sucursal}/horarios`)
      .send({
        horarios: [
          rango(1, "14:00", "18:00"),
          rango(1, "08:00", "12:00"),
          rango(1, "11:30", "15:00"),
          rango(2, "11:30", "15:00"),
        ],
      });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      message: "Hay rangos de horario que se cruzan",
      errors: { "horarios.0": "Se cruza con el rango de 11:30 a 15:00 del lunes" },
    });
    // Mismo rango en otro día no es cruce.
    expect(res.body.errors).not.toHaveProperty("horarios.3");

    const guardados = await api().get(`/sucursales/${sucursal.id_sucursal}/horarios`);
    expect(guardados.body.data).toHaveLength(1);
  });

  it("valida formato: día, horas y cierre posterior a la apertura -> 422", async () => {
    const { sucursal, token } = await sucursalConToken();
    const res = await api(token)
      .put(`/sucursales/${sucursal.id_sucursal}/horarios`)
      .send({
        horarios: [rango(7, "08:00", "12:00"), rango(1, "8:00", "12:00"), rango(2, "12:00", "08:00"), rango(3, "10:00", "10:00")],
      });
    expect(res.status).toBe(422);
    expect(res.body.errors).toMatchObject({
      "horarios.0.dia_semana": expect.any(String),
      "horarios.1.hora_apertura": "Hora inválida: usa HH:MM (00:00 a 23:59)",
      "horarios.2.hora_cierre": "Debe ser posterior a hora_apertura",
      "horarios.3.hora_cierre": "Debe ser posterior a hora_apertura",
    });

    expect((await api(token).put(`/sucursales/${sucursal.id_sucursal}/horarios`).send({})).status).toBe(422);
  });

  it("empleado con configuracion.editar puede; sin él -> 403; sin token -> 401", async () => {
    const { negocio, sucursal } = await sucursalConToken();
    const editor = await crearUsuario();
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: editor, rol: (await crearRol(negocio, { configuracion: ["ver", "editar"] })).id_rol });
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    const body = { horarios: [rango(1, "08:00", "12:00")] };

    expect((await api(await tokenDe(editor)).put(`/sucursales/${sucursal.id_sucursal}/horarios`).send(body)).status).toBe(200);
    expect((await api(await tokenDe(recepcion)).put(`/sucursales/${sucursal.id_sucursal}/horarios`).send(body)).status).toBe(403);
    expect((await api().put(`/sucursales/${sucursal.id_sucursal}/horarios`).send(body)).status).toBe(401);
  });

  it("sucursal de otro negocio -> 403; inexistente o eliminada -> 404", async () => {
    const { negocio, sucursal, token } = await sucursalConToken();
    const eliminada = await crearSucursal(negocio, { activo: false });
    const body = { horarios: [] };

    const ajeno = await tokenDe((await crearNegocio()).propietario);
    expect((await api(ajeno).put(`/sucursales/${sucursal.id_sucursal}/horarios`).send(body)).status).toBe(403);
    expect((await api(token).put("/sucursales/999999/horarios").send(body)).status).toBe(404);
    expect((await api(token).put(`/sucursales/${eliminada.id_sucursal}/horarios`).send(body)).status).toBe(404);
  });
});
