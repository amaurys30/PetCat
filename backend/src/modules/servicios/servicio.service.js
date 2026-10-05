import * as servicioRepo from "./servicio.repository.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { castFields } from "../../shared/utils/format.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { ApiError } from "../../shared/errors/ApiError.js";
const NO_ENCONTRADO = "Servicio no encontrado";

/** Columna SET de MySQL ("perro,gato") como arreglo; NULL se mantiene. */
export const setComoArreglo = (valor) => (valor === null || valor === undefined ? valor : valor ? valor.split(",") : []);

const BOOLS = ["requiere_cita", "visible_app", "en_oferta", "activo", "oferta_vigente", "sin_empleados", "reservable"];
const NUMEROS = ["precio_base", "precio_maximo", "precio_oferta", "peso_min_kg", "peso_max_kg", "precio_actual"];

/** Formato del panel: todos los datos, la categoría y los empleados activos asignados. */
const formatServicio = (row, empleados = []) => {
  const { id_categoria, categoria_nombre, etiquetas_json, ...servicio } = castFields(row, {
    bools: BOOLS,
    numbers: NUMEROS,
  });
  return {
    ...servicio,
    categoria: { id_categoria, nombre: categoria_nombre },
    tipo_mascota: setComoArreglo(servicio.tipo_mascota),
    dias_disponible: setComoArreglo(servicio.dias_disponible),
    etiquetas: typeof etiquetas_json === "string" ? JSON.parse(etiquetas_json) : (etiquetas_json ?? null),
    empleados,
  };
};

/** Valores por defecto de la base para validar la coherencia de un servicio nuevo. */
const POR_DEFECTO = {
  precio_maximo: null,
  peso_min_kg: null,
  peso_max_kg: null,
  en_oferta: false,
  precio_oferta: null,
  fecha_inicio_oferta: null,
  fecha_fin_oferta: null,
};

const CAMPOS_OFERTA = ["en_oferta", "precio_oferta", "fecha_inicio_oferta", "fecha_fin_oferta"];

/**
 * Se crea la oferta o se cambia alguno de sus campos: al crear el servicio, o al
 * editar con un valor distinto del guardado. Una oferta vencida que no se toca no
 * impide editar el resto del servicio.
 */
const tocaOferta = (data, actual) => !actual || CAMPOS_OFERTA.some((c) => c in data && data[c] !== actual[c]);

/**
 * Reglas entre campos, sobre el servicio ya combinado (valores actuales + body).
 * `actual` es el servicio guardado (undefined al crear). 422 con un error por campo.
 */
const validarCoherencia = (s, data, actual) => {
  const errors = {};
  if (s.precio_maximo !== null && s.precio_maximo < s.precio_base) {
    errors.precio_maximo = "Debe ser mayor o igual que precio_base";
  }
  if (s.peso_min_kg !== null && s.peso_max_kg !== null && s.peso_min_kg > s.peso_max_kg) {
    errors.peso_max_kg = "Debe ser mayor o igual que peso_min_kg";
  }
  if (s.en_oferta) {
    if (s.precio_oferta === null) errors.precio_oferta = "Obligatorio si el servicio está en oferta";
    else if (s.precio_oferta >= s.precio_base) errors.precio_oferta = "Debe ser menor que precio_base";
  }
  if (s.fecha_inicio_oferta && s.fecha_fin_oferta && s.fecha_fin_oferta < s.fecha_inicio_oferta) {
    errors.fecha_fin_oferta = "No puede ser anterior a fecha_inicio_oferta";
  }
  if (s.en_oferta && tocaOferta(data, actual)) {
    if (!s.fecha_inicio_oferta) errors.fecha_inicio_oferta = "Obligatoria si el servicio está en oferta";
    if (!s.fecha_fin_oferta) errors.fecha_fin_oferta = "Obligatoria si el servicio está en oferta";
    else if (!errors.fecha_fin_oferta && s.fecha_fin_oferta < hoyISO()) {
      errors.fecha_fin_oferta = "No puede ser anterior a hoy";
    }
  }
  if (Object.keys(errors).length > 0) throw ApiError.unprocessable("Datos inválidos", errors);
};

const verificarCategoria = async (id_categoria, conn) => {
  if (id_categoria !== undefined && !(await servicioRepo.categoriaActivaExiste(id_categoria, conn))) {
    throw ApiError.unprocessable("Datos inválidos", { id_categoria: "La categoría no existe" });
  }
};

/** Los empleados asignados deben ser empleados activos del mismo negocio. */
const verificarEmpleados = async (id_negocio, ids, conn) => {
  if (!ids?.length) return;
  const validos = new Set(await servicioRepo.findEmpleadosActivosDelNegocio(id_negocio, ids, conn));
  const invalidos = ids.filter((id) => !validos.has(id));
  if (invalidos.length > 0) {
    throw ApiError.unprocessable("Datos inválidos", {
      empleados: `No son empleados activos del negocio: ${invalidos.join(", ")}`,
    });
  }
};

/** Nombre único entre los servicios activos del negocio. Requiere el negocio bloqueado. */
const verificarNombreLibre = async (id_negocio, nombre, excluirId, conn) => {
  if (await servicioRepo.findActivoByNombre(id_negocio, nombre, excluirId, conn)) {
    throw ApiError.conflict("Ya existe un servicio activo con ese nombre en el negocio", {
      nombre: "Ya está en uso",
    });
  }
};

/** Servicio con sus empleados activos, en el formato del panel. */
const getServicio = async (id_servicio) => {
  const row = await servicioRepo.findById(id_servicio);
  const empleados = await servicioRepo.findEmpleadosActivosDeServicios([id_servicio]);
  return formatServicio(row, empleados[id_servicio]);
};

/** Detalle del panel: incluye servicios eliminados y ocultos en la app. */
export const getServicioGestion = async (id_servicio) => {
  if (!(await servicioRepo.findById(id_servicio))) throw ApiError.notFound(NO_ENCONTRADO);
  return getServicio(id_servicio);
};

export const getCategorias = () => servicioRepo.findCategoriasActivas();

export const getServicios = async (id_negocio, { page, limit, ...filtros }) => {
  const { rows, total } = await servicioRepo.findPageByNegocio(id_negocio, {
    ...filtros,
    limit,
    offset: (page - 1) * limit,
  });
  const empleados = await servicioRepo.findEmpleadosActivosDeServicios(rows.map((row) => row.id_servicio));
  return {
    rows: rows.map((row) => formatServicio(row, empleados[row.id_servicio])),
    meta: buildMeta(total, page, limit),
  };
};

export const createServicio = async (id_negocio, data) => {
  validarCoherencia({ ...POR_DEFECTO, ...data }, data);
  const id_servicio = await withTransaction(async (conn) => {
    await servicioRepo.lockNegocio(id_negocio, conn);
    await verificarCategoria(data.id_categoria, conn);
    await verificarNombreLibre(id_negocio, data.nombre, 0, conn);
    await verificarEmpleados(id_negocio, data.empleados, conn);
    const id = await servicioRepo.create(id_negocio, data, conn);
    if (data.empleados?.length) await servicioRepo.replaceEmpleadosActivos(id, data.empleados, conn);
    return id;
  });
  return getServicio(id_servicio);
};

/**
 * Edición parcial: las reglas entre campos se validan contra los valores
 * actuales. `empleados` reemplaza el conjunto de empleados activos asignados
 * (`[]` lo deja sin empleados). Se puede editar un servicio eliminado.
 */
export const updateServicio = async (id_servicio, data) => {
  await withTransaction(async (conn) => {
    const actual = await servicioRepo.findById(id_servicio, { conn, forUpdate: true });
    if (!actual) throw ApiError.notFound(NO_ENCONTRADO);
    const guardado = castFields(actual, { bools: BOOLS, numbers: NUMEROS });
    validarCoherencia({ ...guardado, ...data }, data, guardado);

    await verificarCategoria(data.id_categoria, conn);
    if (data.nombre !== undefined && actual.activo) {
      await servicioRepo.lockNegocio(actual.id_negocio, conn);
      await verificarNombreLibre(actual.id_negocio, data.nombre, id_servicio, conn);
    }
    await verificarEmpleados(actual.id_negocio, data.empleados, conn);

    await servicioRepo.update(id_servicio, data, conn);
    if (data.empleados !== undefined) await servicioRepo.replaceEmpleadosActivos(id_servicio, data.empleados, conn);
  });
  return getServicio(id_servicio);
};

/**
 * Borrado lógico. 404 si ya está eliminado; 409 si tiene citas futuras
 * pendientes o confirmadas. Las asignaciones de empleados se conservan.
 */
export const deleteServicio = async (id_servicio) => {
  await withTransaction(async (conn) => {
    const actual = await servicioRepo.findById(id_servicio, { conn, forUpdate: true });
    if (!actual?.activo) throw ApiError.notFound(NO_ENCONTRADO);
    if ((await servicioRepo.countCitasFuturasActivas(id_servicio, conn)) > 0) {
      throw ApiError.conflict("El servicio tiene citas pendientes o confirmadas: cancélalas o reprográmalas antes de eliminarlo");
    }
    await servicioRepo.setActivo(id_servicio, false, conn);
  });
};

/** 409 si ya está activo o si otro servicio activo del negocio tiene su nombre. */
export const reactivarServicio = async (id_servicio) => {
  await withTransaction(async (conn) => {
    const actual = await servicioRepo.findById(id_servicio, { conn, forUpdate: true });
    if (!actual) throw ApiError.notFound(NO_ENCONTRADO);
    if (actual.activo) throw ApiError.conflict("El servicio ya está activo");
    await servicioRepo.lockNegocio(actual.id_negocio, conn);
    await verificarNombreLibre(actual.id_negocio, actual.nombre, id_servicio, conn);
    await servicioRepo.setActivo(id_servicio, true, conn);
  });
  return getServicio(id_servicio);
};
