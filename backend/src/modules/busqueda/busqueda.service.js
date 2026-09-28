import * as busquedaRepo from "./busqueda.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import * as servicioRepo from "../servicios/servicio.repository.js";
import { setComoArreglo } from "../servicios/servicio.service.js";
import { RADIO_MAX_KM } from "./busqueda.schemas.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { castFields, toBool, toNumber } from "../../shared/utils/format.js";
import { redondearKm } from "../../shared/utils/geo.js";
import { conMiniaturas } from "../../shared/utils/storage.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const RADIO_POR_DEFECTO_KM = 10;

/** { lat, lng, radio_km } o null. Sin radio_km se usa configuracion_global.radio_busqueda_km. */
const geoDe = async ({ lat, lng, radio_km }) => {
  if (lat === undefined) return null;
  const porDefecto = await configuracionRepo.getValor("radio_busqueda_km", RADIO_POR_DEFECTO_KM);
  return { lat, lng, radio_km: radio_km ?? Math.min(porDefecto, RADIO_MAX_KM) };
};

const sucursalCercana = (row) =>
  row.sc_id_sucursal ? { id_sucursal: row.sc_id_sucursal, nombre: row.sc_nombre, direccion: row.sc_direccion } : null;

const formatNegocio = ({ sc_id_sucursal, sc_nombre, sc_direccion, ...row }) => ({
  ...conMiniaturas(castFields(row, { bools: ["verificado", "destacado"], numbers: ["calificacion_promedio"] })),
  distancia_km: redondearKm(row.distancia_km),
  sucursal_cercana: sucursalCercana({ sc_id_sucursal, sc_nombre, sc_direccion }),
});

/** Servicio en el formato público de la app (búsqueda y detalle). */
const formatServicio = (row) => ({
  id_servicio: row.id_servicio,
  nombre: row.nombre,
  descripcion: row.descripcion,
  categoria: { id_categoria: row.id_categoria, nombre: row.categoria_nombre, icono: row.categoria_icono },
  negocio: {
    id_negocio: row.id_negocio,
    nombre: row.negocio_nombre,
    tipo: row.negocio_tipo,
    ...conMiniaturas({ logo_url: row.negocio_logo_url }),
    calificacion_promedio: toNumber(row.negocio_calificacion),
    verificado: toBool(row.negocio_verificado),
  },
  precio_base: toNumber(row.precio_base),
  precio_maximo: toNumber(row.precio_maximo),
  tipo_precio: row.tipo_precio,
  precio_actual: toNumber(row.precio_actual),
  oferta_vigente: toBool(row.oferta_vigente),
  oferta_hasta: row.oferta_hasta,
  duracion_minutos: row.duracion_minutos,
  tipo_mascota: setComoArreglo(row.tipo_mascota),
  peso_min_kg: toNumber(row.peso_min_kg),
  peso_max_kg: toNumber(row.peso_max_kg),
  dias_disponible: setComoArreglo(row.dias_disponible),
  requiere_cita: toBool(row.requiere_cita),
  reservable: toBool(row.reservable),
  ...("distancia_km" in row && {
    distancia_km: redondearKm(row.distancia_km),
    sucursal_cercana: sucursalCercana(row),
  }),
});

export const buscarNegocios = async ({ page, limit, lat, lng, radio_km, ...filtros }) => {
  const { rows, total } = await busquedaRepo.buscarNegocios({
    ...filtros,
    geo: await geoDe({ lat, lng, radio_km }),
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: rows.map(formatNegocio), meta: buildMeta(total, page, limit) };
};

export const buscarServicios = async ({ page, limit, lat, lng, radio_km, ...filtros }) => {
  const { rows, total } = await busquedaRepo.buscarServicios({
    ...filtros,
    geo: await geoDe({ lat, lng, radio_km }),
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: rows.map(formatServicio), meta: buildMeta(total, page, limit) };
};

/** Detalle público: 404 si no existe, está inactivo u oculto, o su negocio está inactivo. */
export const getServicioPublico = async (id_servicio) => {
  const row = await busquedaRepo.findServicioPublico(id_servicio);
  if (!row) throw ApiError.notFound("Servicio no encontrado");
  const empleados = await servicioRepo.findEmpleadosActivosDeServicios([id_servicio], { detalle: true });
  return { ...formatServicio(row), empleados: (empleados[id_servicio] ?? []).map(conMiniaturas) };
};
