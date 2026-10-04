import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearInvitacion,
  crearMascota,
  crearNegocio,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
  unique,
} from "../helpers/factories.js";

/**
 * Reemplazar o marcar filas hijas por la columna del padre (`WHERE id_sucursal = ?`...) toma
 * un gap lock del índice secundario cuando el padre todavía no tiene filas. Varios padres
 * nuevos con ids seguidos comparten ese hueco y, si la misma transacción inserta después en
 * esa tabla, terminan en deadlock (500). Cada escenario lanza la operación a la vez sobre
 * padres nuevos de negocios distintos, varias rondas.
 */
const RONDAS = 5;
const PARALELAS = 4;

const enParalelo = async (preparar, ejecutar) => {
  for (let ronda = 0; ronda < RONDAS; ronda++) {
    const casos = [];
    for (let i = 0; i < PARALELAS; i++) casos.push(await preparar());
    const respuestas = await Promise.all(casos.map(ejecutar));
    expect(respuestas.map((r) => r.status)).toEqual(respuestas.map(() => respuestas[0].status));
    expect(respuestas[0].status).toBeLessThan(300);
  }
};

const proximoLunes = () => {
  const fecha = new Date();
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== 1);
  return hoyISO(fecha);
};

describe("filas hijas nuevas en paralelo (sin deadlock)", () => {
  it("horario de sedes sin horario", async () => {
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        return { sede: await crearSucursal(negocio), token: await tokenDe(negocio.propietario) };
      },
      ({ sede, token }) =>
        api(token)
          .put(`/sucursales/${sede.id_sucursal}/horarios`)
          .send({ horarios: [1, 2, 3].map((d) => ({ dia_semana: d, hora_apertura: "08:00", hora_cierre: "12:00" })) }),
    );
  });

  it("horario semanal de empleados sin horario", async () => {
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        const sede = await crearSucursal(negocio);
        await crearHorarios(sede, [[1, "08:00", "18:00"]]);
        return { empleado: await crearEmpleado(negocio), token: await tokenDe(negocio.propietario) };
      },
      ({ empleado, token }) =>
        api(token)
          .put(`/empleados/${empleado.id_empleado}/horario-semanal`)
          .send({ horarios: [{ dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00" }] }),
    );
  });

  it("profesionales de servicios sin profesionales", async () => {
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        return {
          servicio: await crearServicio(negocio),
          empleado: await crearEmpleado(negocio),
          token: await tokenDe(negocio.propietario),
        };
      },
      ({ servicio, empleado, token }) =>
        api(token).patch(`/servicios/${servicio.id_servicio}`).send({ empleados: [empleado.id_empleado] }),
    );
  });

  it("servicios de empleados sin servicios (desde el empleado, con otros datos)", async () => {
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        return {
          servicio: await crearServicio(negocio),
          empleado: await crearEmpleado(negocio),
          token: await tokenDe(negocio.propietario),
        };
      },
      ({ servicio, empleado, token }) =>
        api(token)
          .patch(`/empleados/${empleado.id_empleado}`)
          .send({ especialidad: "Cirugía", servicios: [servicio.id_servicio] }),
    );
  });

  it("primera invitación de empleados nuevos", async () => {
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        return {
          empleado: await crearEmpleado(negocio, { email: `invitado_${unique()}@petcat.test` }),
          token: await tokenDe(negocio.propietario),
        };
      },
      ({ empleado, token }) => api(token).post(`/empleados/${empleado.id_empleado}/invitacion`),
    );
  });

  it("reenviar la invitación de empleados con una invitación vigente", async () => {
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        const empleado = await crearEmpleado(negocio, { email: `reenvio_${unique()}@petcat.test` });
        await crearInvitacion(empleado);
        return { empleado, token: await tokenDe(negocio.propietario) };
      },
      ({ empleado, token }) => api(token).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`),
    );
  });

  it("reprogramar citas sin recordatorios desde el panel (la nueva crea los suyos)", async () => {
    const lunes = proximoLunes();
    await enParalelo(
      async () => {
        const negocio = await crearNegocio();
        const sede = await crearSucursal(negocio);
        await crearHorarios(sede, [1, 2, 3, 4, 5].map((d) => [d, "08:00", "18:00"]));
        const empleado = await crearEmpleado(negocio);
        const servicio = await crearServicio(negocio);
        await pool.query("INSERT INTO empleado_servicios (id_empleado, id_servicio) VALUES (?, ?)", [
          empleado.id_empleado,
          servicio.id_servicio,
        ]);
        const cliente = await crearUsuario();
        const cita = await crearCita(negocio, {
          cliente,
          mascota: await crearMascota(cliente),
          servicio,
          id_sucursal: sede.id_sucursal,
          id_empleado: empleado.id_empleado,
          fecha: lunes,
          estado: "confirmada",
        });
        return { cita, token: await tokenDe(negocio.propietario) };
      },
      ({ cita, token }) =>
        api(token).post(`/citas/${cita.id_cita}/reprogramar`).send({ fecha: lunes, hora_inicio: "11:00" }),
    );
  });
});
