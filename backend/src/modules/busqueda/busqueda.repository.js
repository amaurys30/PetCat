import db from "../../config/db.js";
import { likeLiteral } from "../../shared/utils/sql.js";
import { cercaniaCTE } from "../../shared/utils/geo.js";
import { SQL_OFERTA_VIGENTE, SQL_PRECIO_ACTUAL, SQL_RESERVABLE } from "../servicios/servicio.repository.js";

/** El negocio tiene al menos una sucursal activa (alias `n` = negocios). */
const SQL_CON_SUCURSAL = `EXISTS (SELECT 1 FROM sucursales sa WHERE sa.id_negocio = n.id_negocio AND sa.activo = TRUE)`;

/**
 * Partes comunes de las búsquedas con y sin cercanía. Con `geo`, solo quedan los
 * negocios con coordenadas dentro del radio y se agregan la distancia y la sucursal más cercana.
 */
const partesGeo = (geo) => {
  if (!geo) {
    return {
      withSql: "",
      withValues: [],
      join: "",
      columnas: "NULL AS distancia_km, NULL AS sc_id_sucursal, NULL AS sc_nombre, NULL AS sc_direccion",
    };
  }
  const { sql, values } = cercaniaCTE(geo);
  return {
    withSql: `WITH ${sql}`,
    withValues: values,
    join: `JOIN cercania ce ON ce.id_negocio = n.id_negocio
           LEFT JOIN sucursales sc ON sc.id_sucursal = ce.id_sucursal`,
    columnas: "ce.distancia_km, sc.id_sucursal AS sc_id_sucursal, sc.nombre AS sc_nombre, sc.direccion AS sc_direccion",
  };
};

const pagina = async ({ withSql, withValues, select, from, where, valores, orden, limit, offset }) => {
  const [rows] = await db.query(`${withSql} SELECT ${select} ${from} ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`, [
    ...withValues,
    ...valores,
    limit,
    offset,
  ]);
  const [[{ total }]] = await db.query(`${withSql} SELECT COUNT(*) AS total ${from} ${where}`, [
    ...withValues,
    ...valores,
  ]);
  return { rows, total };
};

// ---------- Negocios ----------

/**
 * Negocios activos con al menos una sucursal activa. Filtros: `q` (nombre o
 * descripción), `tipo`, `id_categoria` (tiene servicios visibles de esa
 * categoría) y `geo` ({ lat, lng, radio_km }).
 * Orden: destacados primero; luego distancia (con geo) o calificación y reseñas.
 */
export const buscarNegocios = async ({ q, tipo, id_categoria, geo, limit, offset }) => {
  const partes = partesGeo(geo);
  const condiciones = ["n.activo = TRUE", SQL_CON_SUCURSAL];
  const valores = [];
  if (q) {
    condiciones.push("(n.nombre LIKE ? OR n.descripcion LIKE ?)");
    valores.push(likeLiteral(q), likeLiteral(q));
  }
  if (tipo) {
    condiciones.push("n.tipo = ?");
    valores.push(tipo);
  }
  if (id_categoria) {
    condiciones.push(`EXISTS (SELECT 1 FROM servicios s
                              WHERE s.id_negocio = n.id_negocio AND s.activo = TRUE
                                AND s.visible_app = TRUE AND s.id_categoria = ?)`);
    valores.push(id_categoria);
  }

  return pagina({
    ...partes,
    select: `n.id_negocio, n.nombre, n.tipo, n.descripcion, n.ciudad, n.logo_url,
             n.calificacion_promedio, n.total_resenas, n.verificado, n.destacado, ${partes.columnas}`,
    from: `FROM negocios n ${partes.join}`,
    where: `WHERE ${condiciones.join(" AND ")}`,
    valores,
    orden: geo
      ? "n.destacado DESC, ce.distancia_km, n.calificacion_promedio DESC, n.id_negocio"
      : "n.destacado DESC, n.calificacion_promedio DESC, n.total_resenas DESC, n.nombre, n.id_negocio",
    limit,
    offset,
  });
};

// ---------- Servicios ----------

const COLUMNAS_SERVICIO = `s.id_servicio, s.nombre, s.descripcion, s.indicaciones_previas,
  c.id_categoria, c.nombre AS categoria_nombre, c.icono AS categoria_icono,
  n.id_negocio, n.nombre AS negocio_nombre, n.tipo AS negocio_tipo, n.logo_url AS negocio_logo_url,
  n.calificacion_promedio AS negocio_calificacion, n.verificado AS negocio_verificado,
  s.precio_base, s.precio_maximo, s.tipo_precio,
  ${SQL_PRECIO_ACTUAL} AS precio_actual, ${SQL_OFERTA_VIGENTE} AS oferta_vigente,
  IF(${SQL_OFERTA_VIGENTE}, s.fecha_fin_oferta, NULL) AS oferta_hasta,
  s.duracion_minutos, s.tipo_mascota, s.peso_min_kg, s.peso_max_kg, s.dias_disponible,
  s.requiere_cita, ${SQL_RESERVABLE} AS reservable`;

const FROM_SERVICIO = `FROM servicios s
  JOIN negocios n ON n.id_negocio = s.id_negocio
  JOIN categorias_servicio c ON c.id_categoria = s.id_categoria`;

// Servicio visible en la app: activo, visible y de un negocio activo.
const SQL_SERVICIO_VISIBLE = "s.activo = TRUE AND s.visible_app = TRUE AND n.activo = TRUE";

/**
 * Servicios visibles de negocios con al menos una sucursal activa. Filtros: `q`
 * (nombre o descripción), `id_categoria`, `id_negocio`, `especie` (incluida en
 * tipo_mascota o servicio para `todos`), `en_oferta` (oferta vigente hoy) y `geo`.
 * Orden: reservables primero; luego distancia (con geo), negocio destacado,
 * calificación del negocio y nombre.
 */
export const buscarServicios = async ({ q, id_categoria, id_negocio, especie, en_oferta, geo, limit, offset }) => {
  const partes = partesGeo(geo);
  const condiciones = [SQL_SERVICIO_VISIBLE, SQL_CON_SUCURSAL];
  const valores = [];
  if (q) {
    condiciones.push("(s.nombre LIKE ? OR s.descripcion LIKE ?)");
    valores.push(likeLiteral(q), likeLiteral(q));
  }
  if (id_categoria) {
    condiciones.push("s.id_categoria = ?");
    valores.push(id_categoria);
  }
  if (id_negocio) {
    condiciones.push("s.id_negocio = ?");
    valores.push(id_negocio);
  }
  if (especie) {
    condiciones.push("(FIND_IN_SET(?, s.tipo_mascota) > 0 OR FIND_IN_SET('todos', s.tipo_mascota) > 0)");
    valores.push(especie);
  }
  if (en_oferta !== undefined) condiciones.push(en_oferta ? SQL_OFERTA_VIGENTE : `NOT ${SQL_OFERTA_VIGENTE}`);

  return pagina({
    ...partes,
    select: `${COLUMNAS_SERVICIO}, ${partes.columnas}`,
    from: `${FROM_SERVICIO} ${partes.join}`,
    where: `WHERE ${condiciones.join(" AND ")}`,
    valores,
    orden: [
      "reservable DESC",
      ...(geo ? ["ce.distancia_km"] : []),
      "n.destacado DESC, n.calificacion_promedio DESC, s.nombre, s.id_servicio",
    ].join(", "),
    limit,
    offset,
  });
};

/** Servicio visible en la app (detalle público). */
export const findServicioPublico = async (id_servicio) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNAS_SERVICIO} ${FROM_SERVICIO} WHERE s.id_servicio = ? AND ${SQL_SERVICIO_VISIBLE}`,
    [id_servicio]
  );
  return rows[0];
};
