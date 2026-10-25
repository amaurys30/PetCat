import * as adminRepo from "./admin.repository.js";
import * as suscripcionRepo from "../suscripciones/suscripcion.repository.js";
import { resolverPlan } from "../suscripciones/suscripcion.service.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { toBool, toNumber } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Administración de la plataforma (solo el super admin). El plan y el estado efectivos se
 * calculan igual que en la suscripción del negocio (`resolverPlan`): una prueba o un plan
 * pago vencidos cuentan como Gratuito aunque el job todavía no los marque.
 */

/** Estado efectivo para la tabla: activa, en_prueba o vencida (volvió al Gratuito). */
const estadoEfectivo = ({ suscripcion, vencida }) =>
  vencida ? "vencida" : suscripcion?.estado === "en_prueba" ? "en_prueba" : "activa";

/**
 * Negocios con su plan efectivo, la suscripción vigente y el uso de las citas del mes. El
 * plan y el estado se calculan al leer, así que se filtra y pagina después de calcularlos
 * (la cantidad de negocios del MVP lo permite).
 */
export const getNegocios = async ({ page, limit, q, id_plan, estado }) => {
  const negocios = await adminRepo.findNegocios({ q });
  const ids = negocios.map((n) => n.id_negocio);
  const [suscripciones, planes] = await Promise.all([
    suscripcionRepo.findByNegocios(ids),
    suscripcionRepo.findAllPlanes(),
  ]);
  const porId = Object.fromEntries(planes.map((p) => [p.id_plan, p]));

  const filas = negocios
    .map((n) => ({ negocio: n, resuelto: resolverPlan(suscripciones[n.id_negocio] ?? [], porId) }))
    .filter(({ resuelto }) => id_plan === undefined || resuelto.plan.id_plan === id_plan)
    .filter(({ resuelto }) => estado === undefined || estadoEfectivo(resuelto) === estado);

  const pagina = filas.slice((page - 1) * limit, page * limit);
  const hoy = hoyISO();
  const citas = await adminRepo.countCitasMes(
    pagina.map(({ negocio }) => negocio.id_negocio),
    hoy
  );

  const rows = pagina.map(({ negocio: n, resuelto }) => {
    const { plan, suscripcion, vencida, planContratado } = resuelto;
    return {
      id_negocio: n.id_negocio,
      nombre: n.nombre,
      tipo: n.tipo,
      ciudad: n.ciudad,
      activo: toBool(n.activo),
      fecha_registro: n.fecha_registro,
      propietario: {
        id_usuario: n.propietario_id,
        nombre: n.propietario_nombre,
        apellido: n.propietario_apellido,
        email: n.propietario_email,
      },
      plan: { id_plan: plan.id_plan, nombre: plan.nombre },
      estado: estadoEfectivo(resuelto),
      suscripcion: suscripcion
        ? {
            id_suscripcion: suscripcion.id_suscripcion,
            plan: { id_plan: planContratado.id_plan, nombre: planContratado.nombre },
            estado: vencida ? "vencida" : suscripcion.estado,
            tipo_facturacion: suscripcion.tipo_facturacion,
            fecha_inicio: suscripcion.fecha_inicio,
            fecha_fin: suscripcion.fecha_fin,
            fecha_prueba_fin: suscripcion.fecha_prueba_fin,
          }
        : null,
      citas_mes: { mes: hoy.slice(0, 7), usadas: citas[n.id_negocio] ?? 0, maximo: plan.max_citas_mes },
    };
  });
  return { rows, meta: buildMeta(filas.length, page, limit) };
};

/** Historial de suscripciones del negocio: cada asignación con el admin que la hizo. */
export const getHistorialSuscripciones = async (id_negocio) => {
  if (!(await adminRepo.existeNegocio(id_negocio))) throw ApiError.notFound("Negocio no encontrado");
  const rows = await suscripcionRepo.findHistorial(id_negocio);
  return rows.map((r) => ({
    id_suscripcion: r.id_suscripcion,
    plan: { id_plan: r.id_plan, nombre: r.plan_nombre },
    estado: r.estado,
    tipo_facturacion: r.tipo_facturacion,
    fecha_inicio: r.fecha_inicio,
    fecha_fin: r.fecha_fin,
    fecha_prueba_fin: r.fecha_prueba_fin,
    monto_pagado: toNumber(r.monto_pagado),
    notas: r.notas,
    fecha_creacion: r.fecha_creacion,
    registrada_por: r.registro_id
      ? {
          id_usuario: r.registro_id,
          nombre: r.registro_nombre,
          apellido: r.registro_apellido,
          email: r.registro_email,
          es_admin: r.registro_tipo === "admin",
        }
      : null,
  }));
};
