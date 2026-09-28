import * as negocioRepo from "./negocio.repository.js";
import * as suscripcionRepo from "../suscripciones/suscripcion.repository.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { castFields } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const formatNegocio = (negocio) =>
  castFields(negocio, {
    bools: ["verificado", "destacado", "activo"],
    numbers: ["latitud", "longitud", "calificacion_promedio"],
  });

const formatServicio = (servicio) => ({
  ...castFields(servicio, {
    bools: ["en_oferta", "oferta_vigente", "reservable"],
    numbers: ["precio_base", "precio_maximo", "precio_oferta", "precio_actual"],
  }),
  // Columna SET: "perro,gato" -> ["perro", "gato"]
  tipo_mascota: servicio.tipo_mascota ? servicio.tipo_mascota.split(",") : [],
});

/**
 * Cualquier usuario autenticado puede crear un negocio y queda como propietario
 * (el acceso al panel es por pertenencia, no por tipo_usuario). En la misma
 * transacción se crea la suscripción al plan Gratuito.
 */
export const createNegocio = async (id_usuario, data) => {
  const id_negocio = await withTransaction(async (conn) => {
    const id = await negocioRepo.create(id_usuario, data, conn);
    await suscripcionRepo.createGratuita(id, conn);
    return id;
  });
  return formatNegocio(await negocioRepo.findById(id_negocio));
};

export const getMisNegocios = async (id_usuario) => {
  const rows = await negocioRepo.findMios(id_usuario);
  return rows.map(({ id_empleado, id_rol, rol_nombre, ...negocio }) => ({
    ...formatNegocio(negocio),
    id_empleado,
    rol: id_rol === null ? null : { id_rol, nombre: rol_nombre },
  }));
};

/**
 * Perfil público para la app: 404 si el negocio no existe o está inactivo. Solo
 * muestra sucursales activas (con sus horarios), servicios activos y visibles en
 * la app, y las últimas reseñas visibles.
 */
export const getPerfilPublico = async (id_negocio) => {
  const negocio = await negocioRepo.findPublicoById(id_negocio);
  if (!negocio) throw ApiError.notFound("Negocio no encontrado");

  const [sucursales, horarios, servicios, resenas] = await Promise.all([
    negocioRepo.findSucursalesPublicas(id_negocio),
    negocioRepo.findHorariosPublicos(id_negocio),
    negocioRepo.findServiciosPublicos(id_negocio),
    negocioRepo.findResenasVisibles(id_negocio),
  ]);

  return {
    ...formatNegocio(negocio),
    sucursales: sucursales.map((sucursal) => ({
      ...castFields(sucursal, { bools: ["es_principal"], numbers: ["latitud", "longitud"] }),
      horarios: horarios
        .filter((h) => h.id_sucursal === sucursal.id_sucursal)
        .map(({ dia_semana, hora_apertura, hora_cierre }) => ({ dia_semana, hora_apertura, hora_cierre })),
    })),
    servicios: servicios.map(formatServicio),
    resenas_recientes: resenas,
  };
};

/** authorize ya resolvió el negocio y comprobó configuracion.editar. */
export const updateNegocio = async (id_negocio, data) => {
  await negocioRepo.update(id_negocio, data);
  return formatNegocio(await negocioRepo.findById(id_negocio));
};
