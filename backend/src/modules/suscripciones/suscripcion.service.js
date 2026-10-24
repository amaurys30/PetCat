import * as suscripcionRepo from "./suscripcion.repository.js";
import * as negocioRepo from "../negocios/negocio.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { configSoporte } from "../notificaciones/notificacion.service.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { diasEntre, hoyISO } from "../../shared/utils/fechas.js";
import { toBool, toNumber } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const ILIMITADO = -1;
const PLAN_POR_DEFECTO = "Gratuito";
const UMBRAL_AVISO_PCT = 80;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const CARACTERISTICAS = [
  "estadisticas_avanzadas",
  "soporte_prioritario",
  "integracion_whatsapp",
  "exportar_informes",
  "ia_recomendaciones",
  "api_personalizada",
  "dominio_personalizado",
  "gestor_dedicado",
  "sla_garantizado",
  "capacitacion_incluida",
];

/**
 * Recursos con límite por plan (`checkPlanLimit`). Las citas del mes van aparte:
 * dependen de la fecha de la cita y se comprueban dentro de la reserva.
 */
const RECURSOS = {
  sucursales: {
    columna: "max_sucursales",
    contar: suscripcionRepo.countSucursalesActivas,
    texto: (n) => (n === 1 ? "1 sucursal activa" : `${n} sucursales activas`),
  },
  empleados: {
    columna: "max_empleados",
    contar: suscripcionRepo.countEmpleadosActivos,
    texto: (n) => (n === 1 ? "1 empleado activo" : `${n} empleados activos`),
  },
  productos: {
    columna: "max_productos",
    contar: suscripcionRepo.countProductosActivos,
    texto: (n) => (n === 1 ? "1 producto activo" : `${n} productos activos`),
  },
};

export const RECURSOS_CON_LIMITE = Object.keys(RECURSOS);

// ---------- Plan efectivo ----------

export const esVigente = (s) => s.estado === "activa" || s.estado === "en_prueba";

/** La prueba vence al terminar `fecha_prueba_fin`; cualquier suscripción, al terminar `fecha_fin`. */
export const estaVencida = (suscripcion, hoy = hoyISO()) =>
  suscripcion.fecha_fin < hoy ||
  (suscripcion.estado === "en_prueba" && suscripcion.fecha_prueba_fin !== null && suscripcion.fecha_prueba_fin < hoy);

/**
 * Suscripción vigente (la más reciente en activa o en_prueba) de las filas del negocio
 * ordenadas por id, si ya venció y el plan efectivo: el de la vigente, o el Gratuito si
 * venció o no hay ninguna. Se calcula al leer: no espera a que el cron marque `vencida`.
 * @param {object[]} suscripciones Filas del negocio, de la más antigua a la más reciente
 * @param {Record<number, object>} planes Planes por id_plan
 */
export const resolverPlan = (suscripciones, planes) => {
  const suscripcion = suscripciones.findLast(esVigente) ?? null;
  const vencida = suscripcion !== null && estaVencida(suscripcion);
  const planContratado = suscripcion ? planes[suscripcion.id_plan] : null;
  const plan =
    suscripcion && !vencida ? planContratado : Object.values(planes).find((p) => p.nombre === PLAN_POR_DEFECTO);
  if (!plan) throw ApiError.internal("No existe el plan Gratuito");
  return { suscripcion, vencida, plan, planContratado };
};

const planesPorId = async (conn) =>
  Object.fromEntries((await suscripcionRepo.findAllPlanes(conn)).map((plan) => [plan.id_plan, plan]));

/**
 * Plan efectivo del negocio. Dentro de una transacción que bloqueó las suscripciones
 * se pasan esas filas en `suscripciones` para no volver a leerlas.
 */
export const getPlanEfectivo = async (id_negocio, { conn, suscripciones } = {}) => {
  const [filas, planes] = await Promise.all([
    suscripciones ?? suscripcionRepo.findByNegocio(id_negocio, conn),
    planesPorId(conn),
  ]);
  return resolverPlan(filas, planes);
};

/** Plan efectivo de varios negocios (para `GET /negocios/mios`): { id_negocio: { id_plan, nombre, en_prueba } }. */
export const getPlanesDeNegocios = async (ids) => {
  const [porNegocio, planes] = await Promise.all([suscripcionRepo.findByNegocios(ids), planesPorId()]);
  return Object.fromEntries(
    ids.map((id) => {
      const { suscripcion, vencida, plan } = resolverPlan(porNegocio[id] ?? [], planes);
      const en_prueba = suscripcion?.estado === "en_prueba" && !vencida;
      return [id, { id_plan: plan.id_plan, nombre: plan.nombre, en_prueba }];
    })
  );
};

// ---------- Formato ----------

export const formatPlan = (plan) => ({
  id_plan: plan.id_plan,
  nombre: plan.nombre,
  descripcion: plan.descripcion,
  precio_mensual: toNumber(plan.precio_mensual),
  precio_anual: toNumber(plan.precio_anual),
  limites: {
    sucursales: plan.max_sucursales,
    empleados: plan.max_empleados,
    citas_mes: plan.max_citas_mes,
    productos: plan.max_productos,
  },
  caracteristicas: Object.fromEntries(CARACTERISTICAS.map((c) => [c, toBool(plan[c])])),
});

const formatSuscripcion = ({ suscripcion, vencida, planContratado }, hoy) => ({
  id_suscripcion: suscripcion.id_suscripcion,
  plan: { id_plan: planContratado.id_plan, nombre: planContratado.nombre },
  estado: vencida ? "vencida" : suscripcion.estado,
  tipo_facturacion: suscripcion.tipo_facturacion,
  fecha_inicio: suscripcion.fecha_inicio,
  fecha_fin: suscripcion.fecha_fin,
  fecha_prueba_fin: suscripcion.fecha_prueba_fin,
  dias_prueba_restantes:
    suscripcion.estado === "en_prueba" && !vencida ? diasEntre(hoy, suscripcion.fecha_prueba_fin) : null,
  auto_renovar: toBool(suscripcion.auto_renovar),
  monto_pagado: toNumber(suscripcion.monto_pagado),
});

const usoDe = (usadas, maximo) => ({ usadas, maximo });

// ---------- Consultas ----------

export const getPlanes = async () => (await suscripcionRepo.findPlanesActivos()).map(formatPlan);

/** Contacto de soporte para contratar un plan mientras no hay pagos en línea (vacío = null). */
const soporteDe = ({ email, whatsapp }) => ({ email: email || null, whatsapp: whatsapp || null });

/** Plan efectivo, suscripción vigente, si puede activar la prueba, uso de cada límite y contacto de soporte. */
export const getSuscripcion = async (id_negocio) => {
  const filas = await suscripcionRepo.findByNegocio(id_negocio);
  const resuelto = resolverPlan(filas, await planesPorId());
  const { plan } = resuelto;
  const hoy = hoyISO();
  const [sucursales, empleados, citas, productos, soporte] = await Promise.all([
    suscripcionRepo.countSucursalesActivas(id_negocio),
    suscripcionRepo.countEmpleadosActivos(id_negocio),
    suscripcionRepo.countCitasMes(id_negocio, hoy),
    suscripcionRepo.countProductosActivos(id_negocio),
    configSoporte(),
  ]);
  return {
    plan: formatPlan(plan),
    suscripcion: resuelto.suscripcion ? formatSuscripcion(resuelto, hoy) : null,
    prueba_disponible: puedeProbar(filas, plan),
    uso: {
      sucursales: usoDe(sucursales, plan.max_sucursales),
      empleados: usoDe(empleados, plan.max_empleados),
      citas_mes: { mes: hoy.slice(0, 7), ...usoDe(citas, plan.max_citas_mes) },
      productos: usoDe(productos, plan.max_productos),
    },
    soporte: soporteDe(soporte),
  };
};

// ---------- Cambios de plan ----------

const yaUsoPrueba = (suscripciones) => suscripciones.some((s) => s.fecha_prueba_fin !== null);

export const puedeProbar = (suscripciones, plan) => plan.nombre === PLAN_POR_DEFECTO && !yaUsoPrueba(suscripciones);

/**
 * Prueba Pro de `dias_prueba_gratis` días, una vez por negocio y solo desde el plan
 * Gratuito. Solo el propietario (y el admin de plataforma). Cierra la suscripción
 * vigente e inserta la de prueba, con las suscripciones del negocio bloqueadas.
 */
export const iniciarPrueba = async (id_negocio, acceso) => {
  if (acceso.relacion !== "propietario" && acceso.relacion !== "admin") {
    throw ApiError.forbidden("Solo el propietario del negocio puede activar la prueba del plan Pro");
  }
  const dias = await configuracionRepo.getValor("dias_prueba_gratis", 14);
  await withTransaction(async (conn) => {
    const suscripciones = await suscripcionRepo.lockByNegocio(id_negocio, conn);
    const resuelto = await getPlanEfectivo(id_negocio, { conn, suscripciones });
    if (resuelto.plan.nombre !== PLAN_POR_DEFECTO) {
      throw ApiError.conflict(`El negocio ya tiene el plan ${resuelto.plan.nombre}`);
    }
    if (yaUsoPrueba(suscripciones)) throw ApiError.conflict("El negocio ya usó su prueba gratuita del plan Pro");

    const pro = await suscripcionRepo.findPlanByNombre("Pro", conn);
    if (!pro?.activo) throw ApiError.internal("No existe el plan Pro");
    if (resuelto.suscripcion) await suscripcionRepo.cerrar(resuelto.suscripcion, resuelto.vencida, conn);
    await suscripcionRepo.createPrueba(id_negocio, pro.id_plan, dias, conn);
  });
  return getSuscripcion(id_negocio);
};

/**
 * Asignación manual del admin de plataforma (sin pasarela hasta la Fase 3): cierra la
 * vigente e inserta una `activa` desde hoy. Sin `fecha_fin`, un mes o un año según la
 * facturación; el Gratuito no vence.
 */
export const asignarPlan = async (id_negocio, data) => {
  if (!(await negocioRepo.findById(id_negocio))) throw ApiError.notFound("Negocio no encontrado");
  const plan = await suscripcionRepo.findPlanById(data.id_plan);
  if (!plan?.activo) throw ApiError.unprocessable("Datos inválidos", { id_plan: "El plan no existe" });
  if (plan.nombre === PLAN_POR_DEFECTO && data.fecha_fin !== undefined) {
    throw ApiError.unprocessable("Datos inválidos", { fecha_fin: "El plan Gratuito no vence" });
  }

  await withTransaction(async (conn) => {
    const suscripciones = await suscripcionRepo.lockByNegocio(id_negocio, conn);
    const resuelto = await getPlanEfectivo(id_negocio, { conn, suscripciones });
    if (resuelto.suscripcion) await suscripcionRepo.cerrar(resuelto.suscripcion, resuelto.vencida, conn);
    await suscripcionRepo.createAsignada(id_negocio, { ...data, plan }, conn);
  });
  return getSuscripcion(id_negocio);
};

// ---------- Límites ----------

const errorLimite = (mensaje, detalle) => ApiError.forbidden(`${mensaje}. Mejora tu plan para continuar.`, { plan: detalle });

/**
 * 403 si el negocio ya usa todo lo que su plan permite de `recurso` (sucursales,
 * empleados o productos). Sin `conn` es la comprobación rápida de `checkPlanLimit`;
 * dentro de una transacción se usa `bloquearYVerificarLimite`.
 */
export const verificarLimite = async (id_negocio, recurso, { conn, suscripciones } = {}) => {
  const definicion = RECURSOS[recurso];
  if (!definicion) throw ApiError.internal(`Recurso sin límite de plan: ${recurso}`);
  const { plan } = await getPlanEfectivo(id_negocio, { conn, suscripciones });
  const maximo = plan[definicion.columna];
  if (maximo === ILIMITADO) return;
  const usadas = await definicion.contar(id_negocio, conn);
  if (usadas >= maximo) {
    throw errorLimite(
      `Tu plan ${plan.nombre} permite hasta ${definicion.texto(maximo)}`,
      `Límite de ${recurso} alcanzado (${usadas} de ${maximo})`
    );
  }
};

/**
 * Comprobación exacta dentro de una transacción: bloquea las suscripciones del
 * negocio (dos altas simultáneas no pasan del límite) y cuenta. Va antes de los
 * demás bloqueos de la operación.
 */
export const bloquearYVerificarLimite = async (id_negocio, recurso, conn) => {
  const suscripciones = await suscripcionRepo.lockByNegocio(id_negocio, conn);
  await verificarLimite(id_negocio, recurso, { conn, suscripciones });
};

/**
 * Estado del límite de citas del mes de `fecha`: `{ plan, maximo, usadas, alcanzado }`.
 * Con plan ilimitado no cuenta (`usadas` null). `excluirIdCita` es la cita que se
 * reprograma: aún no está marcada como reprogramada fuera de la transacción.
 */
export const getLimiteCitasMes = async (id_negocio, fecha, { conn, suscripciones, excluirIdCita = 0 } = {}) => {
  const { plan } = await getPlanEfectivo(id_negocio, { conn, suscripciones });
  const maximo = plan.max_citas_mes;
  if (maximo === ILIMITADO) return { plan, maximo, usadas: null, alcanzado: false };
  const usadas = await suscripcionRepo.countCitasMes(id_negocio, fecha, excluirIdCita, conn);
  return { plan, maximo, usadas, alcanzado: usadas >= maximo };
};

/** Motivo explícito para el panel: "El negocio alcanzó las 30 citas de su plan Gratuito en octubre de 2026". */
export const motivoLimiteCitas = ({ plan, maximo }, fecha) => {
  const [anio, mes] = fecha.split("-");
  return `El negocio alcanzó las ${maximo} citas de su plan ${plan.nombre} en ${MESES[Number(mes) - 1]} de ${anio}`;
};

/**
 * Error de una reserva rechazada por el límite de citas del mes. La app recibe el
 * 409 neutro de horario no disponible (no revela el plan del negocio); el panel, 403
 * con el motivo. `limitePlan` queda en el error para avisar al negocio (2.3).
 */
export const errorLimiteCitas = (canal, limite, fecha, id_negocio) => {
  const error =
    canal === "app"
      ? ApiError.conflict("El horario ya no está disponible: elige otro")
      : errorLimite(motivoLimiteCitas(limite, fecha), `Límite de citas del mes alcanzado (${limite.usadas} de ${limite.maximo})`);
  error.limitePlan = {
    id_negocio,
    recurso: "citas_mes",
    mes: fecha.slice(0, 7),
    maximo: limite.maximo,
    usadas: limite.usadas,
    plan: limite.plan.nombre,
  };
  return error;
};

/**
 * La cita que se acaba de reservar hace pasar el uso del mes al umbral de aviso
 * (80 %): `usadasAntes` no llegaba y con esta llega. Solo una reserva por mes lo cruza.
 */
export const cruzaUmbralAviso = (usadasAntes, maximo, pct = UMBRAL_AVISO_PCT) => {
  if (maximo === ILIMITADO || maximo <= 0) return false;
  const umbral = Math.ceil((maximo * pct) / 100);
  return usadasAntes < umbral && usadasAntes + 1 >= umbral;
};
