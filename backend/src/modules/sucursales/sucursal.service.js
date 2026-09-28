import * as sucursalRepo from "./sucursal.repository.js";
import * as negocioRepo from "../negocios/negocio.repository.js";
import { bloquearYVerificarLimite } from "../suscripciones/suscripcion.service.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { castFields } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

export const formatSucursal = (sucursal) =>
  castFields(sucursal, { bools: ["es_principal", "activo"], numbers: ["latitud", "longitud"] });

const NO_ENCONTRADA = "Sucursal no encontrada";

export const getSucursalesPublicas = async (id_negocio) => {
  const negocio = await negocioRepo.findById(id_negocio);
  if (!negocio || !negocio.activo) throw ApiError.notFound("Negocio no encontrado");
  const sucursales = await sucursalRepo.findActivasByNegocio(id_negocio);
  return sucursales.map(formatSucursal);
};

export const getSucursalPublica = async (id_sucursal) => {
  const sucursal = await sucursalRepo.findPublicaById(id_sucursal);
  if (!sucursal) throw ApiError.notFound(NO_ENCONTRADA);
  return formatSucursal(sucursal);
};

/**
 * La primera sucursal activa del negocio queda como principal. Si se crea como
 * principal, la anterior deja de serlo. El límite del plan se comprueba con las
 * suscripciones bloqueadas antes que las sucursales.
 */
export const createSucursal = async (id_negocio, data) => {
  const id_sucursal = await withTransaction(async (conn) => {
    await bloquearYVerificarLimite(id_negocio, "sucursales", conn);
    const activas = await sucursalRepo.lockActivasByNegocio(id_negocio, conn);
    const es_principal = activas.length === 0 || data.es_principal === true;
    if (es_principal) await sucursalRepo.clearPrincipal(id_negocio, conn);
    return sucursalRepo.create(id_negocio, { ...data, es_principal }, conn);
  });
  return formatSucursal(await sucursalRepo.findById(id_sucursal));
};

/**
 * Sucursal activa leída con las sucursales activas del negocio bloqueadas (FOR UPDATE),
 * más el total de activas. 404 si no existe o está inactiva.
 */
const findActivaBloqueada = async (id_sucursal, conn) => {
  const sucursal = await sucursalRepo.findById(id_sucursal, conn);
  if (!sucursal?.activo) throw ApiError.notFound(NO_ENCONTRADA);
  const activas = await sucursalRepo.lockActivasByNegocio(sucursal.id_negocio, conn);
  const bloqueada = activas.find((s) => s.id_sucursal === sucursal.id_sucursal);
  if (!bloqueada) throw ApiError.notFound(NO_ENCONTRADA);
  return { ...sucursal, es_principal: bloqueada.es_principal, totalActivas: activas.length };
};

/**
 * Marcar otra como principal desmarca la anterior. No se puede desmarcar la
 * principal directamente: siempre debe haber una (409).
 */
export const updateSucursal = async (id_sucursal, data) => {
  await withTransaction(async (conn) => {
    const sucursal = await findActivaBloqueada(id_sucursal, conn);

    if (data.es_principal === false && sucursal.es_principal) {
      throw ApiError.conflict(
        "Debe haber una sucursal principal: marca otra sucursal como principal en lugar de desmarcar esta"
      );
    }
    if (data.es_principal === true && !sucursal.es_principal) {
      await sucursalRepo.clearPrincipal(sucursal.id_negocio, conn);
    }
    await sucursalRepo.update(id_sucursal, data, conn);
  });
  return formatSucursal(await sucursalRepo.findById(id_sucursal));
};

/**
 * Borrado lógico. 409 si tiene citas futuras pendientes o confirmadas, o si es
 * la principal y el negocio tiene otras sucursales activas.
 */
export const deleteSucursal = async (id_sucursal) => {
  await withTransaction(async (conn) => {
    const sucursal = await findActivaBloqueada(id_sucursal, conn);

    const citas = await sucursalRepo.countCitasFuturasActivas(id_sucursal, conn);
    if (citas > 0) {
      throw ApiError.conflict(
        `La sucursal tiene ${citas} ${citas === 1 ? "cita futura" : "citas futuras"} pendientes o confirmadas: cancélalas o reprográmalas antes de eliminarla`
      );
    }
    if (sucursal.es_principal && sucursal.totalActivas > 1) {
      throw ApiError.conflict("Es la sucursal principal: marca otra como principal antes de eliminarla");
    }
    await sucursalRepo.softDelete(id_sucursal, conn);
  });
};
