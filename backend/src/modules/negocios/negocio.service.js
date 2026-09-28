import * as negocioRepo from "./negocio.repository.js";
import * as suscripcionRepo from "../suscripciones/suscripcion.repository.js";
import { getPlanesDeNegocios } from "../suscripciones/suscripcion.service.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { castFields } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { conMiniaturas } from "../../shared/utils/storage.js";
import { quitarImagen, reemplazarImagen } from "../archivos/archivo.service.js";

const formatNegocio = (negocio) =>
  conMiniaturas(
    castFields(negocio, {
      bools: ["verificado", "destacado", "activo"],
      numbers: ["latitud", "longitud", "calificacion_promedio"],
    })
  );

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
  const planes = await getPlanesDeNegocios(rows.map((row) => row.id_negocio));
  return rows.map(({ id_empleado, id_rol, rol_nombre, ...negocio }) => ({
    ...formatNegocio(negocio),
    id_empleado,
    rol: id_rol === null ? null : { id_rol, nombre: rol_nombre },
    plan: planes[negocio.id_negocio],
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

// ---------- Logo y banner ----------

// Tipo de imagen -> entidad en `archivos`, columna y mensaje si no hay.
const IMAGENES = {
  logo: { entidad: "negocio_logo", columna: "logo_url", sinImagen: "El negocio no tiene logo" },
  banner: { entidad: "negocio_banner", columna: "banner_url", sinImagen: "El negocio no tiene banner" },
};

const imagenDelNegocio = (id_negocio, tipo, id_usuario) => {
  const { entidad, columna, sinImagen } = IMAGENES[tipo];
  return {
    entidad,
    id_entidad: id_negocio,
    id_usuario,
    sinImagen,
    bloquear: async (conn) => (await negocioRepo.lockImagenes(id_negocio, conn))[columna],
    guardarUrl: (conn, url) => negocioRepo.setImagen(id_negocio, columna, url, conn),
  };
};

/** Sube o reemplaza el logo o el banner (`tipo`); la imagen anterior se borra. */
export const subirImagen = async (id_negocio, tipo, id_usuario, archivo) => {
  await reemplazarImagen({ ...imagenDelNegocio(id_negocio, tipo, id_usuario), archivo });
  return formatNegocio(await negocioRepo.findById(id_negocio));
};

export const eliminarImagen = async (id_negocio, tipo, id_usuario) => {
  await quitarImagen(imagenDelNegocio(id_negocio, tipo, id_usuario));
  return formatNegocio(await negocioRepo.findById(id_negocio));
};
