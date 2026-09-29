import * as resenaRepo from "./resena.repository.js";
import * as negocioRepo from "../negocios/negocio.repository.js";
import { plazoAbierto, plazoDias, resenarAntesDe } from "./resena.plazo.js";
import { eventoCita } from "../citas/cita.avisos.js";
import { conNotificaciones } from "../notificaciones/notificacion.service.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Reseñas (2.6). El dueño reseña una cita completada, una vez, dentro del plazo; el
 * negocio responde y reporta. Reportar no oculta: solo el super admin cambia `visible`
 * (Fase 4). Toda escritura que cambia la calificación del negocio bloquea antes la cita
 * y el negocio (orden: cita, negocio, reseña).
 */

// Quién responde las reseñas: recibe el aviso de una reseña nueva (además del propietario).
const PERMISO_RESPONDER = ["resenas", "responder"];

// ---------- Formatos ----------

/** "Sofía Gómez" -> "Sofía G."; sin apellido, solo el nombre. */
export const autorPublico = (nombre, apellido) => {
  const inicial = String(apellido ?? "").trim().charAt(0);
  return inicial ? `${nombre} ${inicial.toUpperCase()}.` : nombre;
};

const ultimaRespuesta = (row) => row.fecha_edicion_respuesta ?? row.fecha_respuesta;

/** Campos comunes: contenido, respuesta del negocio y ediciones. */
const formatBase = (row) => ({
  id_resena: row.id_resena,
  calificacion: row.calificacion,
  aspectos: {
    atencion: row.calif_atencion,
    precio: row.calif_precio,
    instalaciones: row.calif_instalaciones,
    puntualidad: row.calif_puntualidad,
  },
  titulo: row.titulo,
  comentario: row.comentario,
  fecha_creacion: row.fecha_creacion,
  fecha_edicion: row.fecha_edicion,
  // El autor la cambió después de la última respuesta: la respuesta puede no corresponder.
  editada_despues_de_respuesta: Boolean(row.respuesta_negocio && row.fecha_edicion && row.fecha_edicion > ultimaRespuesta(row)),
  respuesta: row.respuesta_negocio
    ? { texto: row.respuesta_negocio, fecha: ultimaRespuesta(row), editada: row.fecha_edicion_respuesta !== null }
    : null,
});

/**
 * Lo público: autor como "Nombre I." y el mes de la visita (sin fecha exacta, servicio,
 * mascota ni datos de contacto). No indica si está reportada.
 */
export const formatPublica = (row) => ({
  ...formatBase(row),
  autor: autorPublico(row.autor_nombre, row.autor_apellido),
  visita_verificada: row.cita_fecha ? row.cita_fecha.slice(0, 7) : null,
});

/** Vista del autor: su reseña con el negocio, la cita y hasta cuándo puede editarla. */
const formatDelAutor = (row, dias, ahora = new Date()) => {
  const antesDe = resenarAntesDe(row.fecha_completada, dias);
  return {
    ...formatBase(row),
    id_cita: row.id_cita,
    negocio: { id_negocio: row.id_negocio, nombre: row.negocio_nombre, logo_url: row.negocio_logo_url },
    servicio: row.id_servicio ? { id_servicio: row.id_servicio, nombre: row.servicio_nombre } : null,
    // false: la ocultó la moderación de PetCat.
    visible: Boolean(row.visible),
    editar_antes_de: antesDe,
    puede_editar: plazoAbierto(antesDe, ahora),
  };
};

/**
 * Vista del panel: cliente, cita y reporte. `cliente_registrado_por_negocio` solo para el
 * super admin (señal para la moderación de la Fase 4), nunca para el negocio.
 */
const formatPanel = (row, acceso) => ({
  ...formatBase(row),
  cliente: { id_usuario: row.id_usuario, nombre: row.autor_nombre, apellido: row.autor_apellido },
  cita: row.id_cita
    ? { id_cita: row.id_cita, fecha: row.cita_fecha, servicio: row.id_servicio ? { id_servicio: row.id_servicio, nombre: row.servicio_nombre } : null }
    : null,
  visible: Boolean(row.visible),
  reporte: row.reportada
    ? {
        motivo: row.motivo_reporte,
        detalle: row.detalle_reporte,
        fecha: row.fecha_reporte,
        reportada_por: row.reporta_id_usuario
          ? { id_usuario: row.reporta_id_usuario, nombre: row.reporta_nombre, apellido: row.reporta_apellido }
          : null,
      }
    : null,
  ...(acceso?.relacion === "admin" && { cliente_registrado_por_negocio: Boolean(row.cliente_registrado_por_negocio) }),
});

/** Aspectos del body -> columnas (lo que no viene queda NULL). */
const contenido = ({ calificacion, titulo, comentario, aspectos = {} }) => ({
  calificacion,
  titulo: titulo ?? null,
  comentario: comentario ?? null,
  calif_atencion: aspectos.atencion ?? null,
  calif_precio: aspectos.precio ?? null,
  calif_instalaciones: aspectos.instalaciones ?? null,
  calif_puntualidad: aspectos.puntualidad ?? null,
});

const noEncontrada = () => ApiError.notFound("Reseña no encontrada");

const verificarPlazo = (fecha_completada, dias, accion) => {
  if (!plazoAbierto(resenarAntesDe(fecha_completada, dias), new Date())) {
    throw ApiError.conflict(`Terminó el plazo de ${dias} días para ${accion} después de la cita`);
  }
};

// ---------- Dueño ----------

/**
 * Reseña de una cita completada: solo su dueño, una vez por cita (tampoco si la retiró),
 * dentro del plazo y sin ser propietario ni empleado activo del negocio. Avisa al
 * propietario y a quien tiene resenas.responder.
 */
export const crearResena = async (id_cita, data, usuario) => {
  const dias = await plazoDias();
  const id_resena = await conNotificaciones(async (conn, notificar) => {
    const cita = await resenaRepo.lockCita(id_cita, conn);
    if (!cita) throw ApiError.notFound("Cita no encontrada");
    if (cita.id_usuario !== usuario.id_usuario) throw ApiError.forbidden("Solo el dueño de la cita puede reseñarla");
    if (cita.estado !== "completada") throw ApiError.conflict("Solo se reseñan citas completadas");
    if (await resenaRepo.esPersonal(usuario.id_usuario, cita.id_negocio, conn)) {
      throw ApiError.forbidden("El propietario y los empleados del negocio no pueden reseñarlo");
    }
    const existente = await resenaRepo.findByCita(id_cita, conn);
    if (existente) {
      throw ApiError.conflict(existente.retirada_en ? "Retiraste la reseña de esta cita: no se puede reseñar otra vez" : "Ya reseñaste esta cita");
    }
    verificarPlazo(cita.fecha_completada, dias, "reseñar");

    await resenaRepo.lockNegocio(cita.id_negocio, conn);
    const id = await resenaRepo.create(
      {
        id_negocio: cita.id_negocio,
        id_usuario: usuario.id_usuario,
        id_cita,
        ...contenido(data),
        cliente_registrado_por_negocio: await resenaRepo.registradoPorNegocio(usuario.id_usuario, cita.id_negocio, conn),
      },
      conn
    );
    await notificar([
      await eventoCita(
        "resena_nueva",
        id_cita,
        { para: "negocio", actor: usuario, permiso: PERMISO_RESPONDER, extra: { calificacion: data.calificacion, titulo: data.titulo ?? null }, enlace: { id_resena: id } },
        conn
      ),
    ]);
    return id;
  });
  return formatDelAutor(await resenaRepo.findById(id_resena), dias);
};

/** Reseña del usuario sin retirar, o 404 (también si es de otro: no se revela que existe). */
const resenaDelAutor = async (id_resena, id_usuario) => {
  const resena = await resenaRepo.findBasica(id_resena);
  if (!resena || resena.id_usuario !== id_usuario || resena.retirada_en) throw noEncontrada();
  return resena;
};

/** El autor reemplaza su reseña dentro del plazo. */
export const editarResena = async (id_resena, data, usuario) => {
  const dias = await plazoDias();
  const resena = await resenaDelAutor(id_resena, usuario.id_usuario);
  await withTransaction(async (conn) => {
    const cita = resena.id_cita ? await resenaRepo.lockCita(resena.id_cita, conn) : null;
    await resenaRepo.lockNegocio(resena.id_negocio, conn);
    const actual = await resenaRepo.lockResena(id_resena, conn);
    if (!actual || actual.retirada_en) throw noEncontrada();
    verificarPlazo(cita?.fecha_completada ?? null, dias, "editar la reseña");
    await resenaRepo.updateContenido(id_resena, contenido(data), conn);
  });
  return formatDelAutor(await resenaRepo.findById(id_resena), dias);
};

/** El autor retira su reseña (en cualquier momento): deja de verse y de contar en la calificación. */
export const retirarResena = async (id_resena, usuario) => {
  const resena = await resenaDelAutor(id_resena, usuario.id_usuario);
  await withTransaction(async (conn) => {
    await resenaRepo.lockNegocio(resena.id_negocio, conn);
    const actual = await resenaRepo.lockResena(id_resena, conn);
    if (!actual || actual.retirada_en) throw noEncontrada();
    await resenaRepo.retirar(id_resena, conn);
  });
};

export const getMisResenas = async (id_usuario, { page, limit }) => {
  const [dias, { rows, total }] = await Promise.all([
    plazoDias(),
    resenaRepo.findDeUsuario(id_usuario, { limit, offset: (page - 1) * limit }),
  ]);
  return { rows: rows.map((row) => formatDelAutor(row, dias)), meta: buildMeta(total, page, limit) };
};

// ---------- Público ----------

/** Reseñas visibles de un negocio activo, con la distribución de calificaciones. */
export const getResenasPublicas = async (id_negocio, { page, limit, orden, calificacion }) => {
  const negocio = await negocioRepo.findPublicoById(id_negocio);
  if (!negocio) throw ApiError.notFound("Negocio no encontrado");
  const [{ rows, total }, distribucion] = await Promise.all([
    resenaRepo.findPublicas(id_negocio, { orden, calificacion, limit, offset: (page - 1) * limit }),
    resenaRepo.findDistribucion(id_negocio),
  ]);
  return {
    rows: rows.map(formatPublica),
    meta: {
      ...buildMeta(total, page, limit),
      resumen: {
        calificacion_promedio: Number(negocio.calificacion_promedio),
        total_resenas: negocio.total_resenas,
        distribucion,
      },
    },
  };
};

/** Las más recientes para el perfil público del negocio. */
export const getRecientesPublicas = async (id_negocio, limit = 5) => {
  const { rows } = await resenaRepo.findPublicas(id_negocio, { limit, offset: 0 });
  return rows.map(formatPublica);
};

// ---------- Panel ----------

export const getResenasGestion = async (id_negocio, acceso, { page, limit, ...filtros }) => {
  const { rows, total } = await resenaRepo.findGestion(id_negocio, { ...filtros, limit, offset: (page - 1) * limit });
  return { rows: rows.map((row) => formatPanel(row, acceso)), meta: buildMeta(total, page, limit) };
};

/**
 * Crea o reemplaza la respuesta del negocio (authorize ya comprobó resenas.responder y que
 * la reseña no está retirada). El dueño recibe `resena_respondida` solo con la primera.
 */
export const responderResena = async (id_resena, { respuesta }, actor, acceso) => {
  await conNotificaciones(async (conn, notificar) => {
    const resena = await resenaRepo.lockResena(id_resena, conn);
    if (!resena || resena.retirada_en) throw noEncontrada();
    const primera = resena.fecha_respuesta === null;
    await resenaRepo.responder(id_resena, respuesta, { primera }, conn);
    if (primera && resena.id_cita) {
      await notificar([
        await eventoCita("resena_respondida", resena.id_cita, { para: "dueno", actor, enlace: { id_resena } }, conn),
      ]);
    }
  });
  return formatPanel(await resenaRepo.findById(id_resena), acceso);
};

export const borrarRespuesta = async (id_resena, acceso) => {
  await withTransaction(async (conn) => {
    const resena = await resenaRepo.lockResena(id_resena, conn);
    if (!resena || resena.retirada_en) throw noEncontrada();
    if (!resena.respuesta_negocio) throw ApiError.conflict("La reseña no tiene respuesta");
    await resenaRepo.borrarRespuesta(id_resena, conn);
  });
  return formatPanel(await resenaRepo.findById(id_resena), acceso);
};

/** Reporte para la moderación: una vez por reseña; la reseña sigue visible y cuenta en el promedio. */
export const reportarResena = async (id_resena, { motivo, detalle }, actor, acceso) => {
  await withTransaction(async (conn) => {
    const resena = await resenaRepo.lockResena(id_resena, conn);
    if (!resena || resena.retirada_en) throw noEncontrada();
    if (resena.reportada) throw ApiError.conflict("Esta reseña ya fue reportada: PetCat la revisará");
    await resenaRepo.reportar(id_resena, { motivo, detalle: detalle ?? null, id_usuario: actor.id_usuario }, conn);
  });
  return formatPanel(await resenaRepo.findById(id_resena), acceso);
};
