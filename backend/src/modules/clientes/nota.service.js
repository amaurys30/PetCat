import * as notaRepo from "./nota.repository.js";
import * as clienteRepo from "./cliente.repository.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Notas del negocio sobre sus clientes (2.7). Solo existen dentro del negocio que las
 * escribió: authorize resuelve el negocio de la nota, así que otro negocio recibe 403 (como
 * todo recurso ajeno), y ningún endpoint del dueño las incluye.
 */

// Quien administra el negocio también puede borrar notas de otros (no editarlas).
const administra = (acceso) => acceso.relacion === "propietario" || acceso.relacion === "admin";

export const formatNota = (row, usuario, acceso) => ({
  id_nota: row.id_nota,
  texto: row.texto,
  autor: row.id_usuario_autor
    ? { id_usuario: row.id_usuario_autor, nombre: row.autor_nombre, apellido: row.autor_apellido }
    : null,
  fecha_creacion: row.fecha_creacion,
  fecha_edicion: row.fecha_edicion,
  editable: row.id_usuario_autor === usuario.id_usuario,
  eliminable: row.id_usuario_autor === usuario.id_usuario || administra(acceso),
});

const verificarCliente = async (id_negocio, id_usuario) => {
  if (!(await clienteRepo.findClienteDeNegocio(id_usuario, id_negocio))) {
    throw ApiError.notFound("Cliente no encontrado en este negocio");
  }
};

export const getNotas = async (id_negocio, id_usuario, { page, limit }, usuario, acceso) => {
  await verificarCliente(id_negocio, id_usuario);
  const { rows, total } = await notaRepo.findPage(id_negocio, id_usuario, { limit, offset: (page - 1) * limit });
  return { rows: rows.map((row) => formatNota(row, usuario, acceso)), meta: buildMeta(total, page, limit) };
};

/** Las más recientes y el total, para el detalle del cliente. */
export const getResumenNotas = async (id_negocio, id_usuario, usuario, acceso, limit = 3) => {
  const { rows, total } = await notaRepo.findPage(id_negocio, id_usuario, { limit, offset: 0 });
  return { notas_recientes: rows.map((row) => formatNota(row, usuario, acceso)), total_notas: total };
};

export const crearNota = async (id_negocio, id_usuario, { texto }, usuario, acceso) => {
  await verificarCliente(id_negocio, id_usuario);
  const id_nota = await notaRepo.create({ id_negocio, id_usuario, id_usuario_autor: usuario.id_usuario, texto });
  return formatNota(await notaRepo.findById(id_nota), usuario, acceso);
};

const findNota = async (id_nota) => {
  const nota = await notaRepo.findById(id_nota);
  if (!nota) throw ApiError.notFound("Nota no encontrada");
  return nota;
};

/** Solo el autor la edita. */
export const editarNota = async (id_nota, { texto }, usuario, acceso) => {
  const nota = await findNota(id_nota);
  if (nota.id_usuario_autor !== usuario.id_usuario) throw ApiError.forbidden("Solo quien escribió la nota puede editarla");
  await notaRepo.updateTexto(id_nota, texto);
  return formatNota(await notaRepo.findById(id_nota), usuario, acceso);
};

/** El autor o quien administra el negocio (propietario, admin de plataforma) la borra. */
export const borrarNota = async (id_nota, usuario, acceso) => {
  const nota = await findNota(id_nota);
  if (nota.id_usuario_autor !== usuario.id_usuario && !administra(acceso)) {
    throw ApiError.forbidden("Solo quien escribió la nota o el propietario del negocio pueden borrarla");
  }
  await notaRepo.remove(id_nota);
};
