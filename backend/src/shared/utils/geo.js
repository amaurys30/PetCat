/**
 * Búsqueda por cercanía. La distancia de un negocio es la de su sucursal activa
 * más cercana con coordenadas; si ninguna sucursal activa las tiene, se usan las
 * del negocio (con su sucursal principal como `id_sucursal`). Un negocio sin
 * coordenadas en ningún lado no aparece en estas búsquedas.
 */

const KM_POR_GRADO = 111.045;

/**
 * CTE `cercania (id_negocio, id_sucursal, distancia_km)`: un punto por negocio,
 * el más cercano a (lat, lng), dentro de `radio_km`. Antes de calcular la
 * distancia se descartan los puntos fuera del recuadro que contiene el círculo.
 * Uso: `WITH ${sql} SELECT ... JOIN cercania ce ON ce.id_negocio = n.id_negocio`,
 * con `values` antes que los demás parámetros de la consulta.
 */
export const cercaniaCTE = ({ lat, lng, radio_km }) => {
  const dLat = radio_km / KM_POR_GRADO;
  const dLng = radio_km / (KM_POR_GRADO * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const distancia = "ST_Distance_Sphere(POINT(p.longitud, p.latitud), POINT(?, ?))";

  const sql = `cercania AS (
    SELECT id_negocio, id_sucursal, distancia_km
    FROM (
      SELECT p.id_negocio, p.id_sucursal, ${distancia} / 1000 AS distancia_km,
             ROW_NUMBER() OVER (PARTITION BY p.id_negocio ORDER BY ${distancia}, p.id_sucursal) AS orden
      FROM (
        SELECT s.id_negocio, s.id_sucursal, s.latitud, s.longitud
        FROM sucursales s
        WHERE s.activo = TRUE AND s.latitud IS NOT NULL AND s.longitud IS NOT NULL
        UNION ALL
        SELECT n.id_negocio,
               (SELECT sp.id_sucursal FROM sucursales sp
                WHERE sp.id_negocio = n.id_negocio AND sp.activo = TRUE
                ORDER BY sp.es_principal DESC, sp.id_sucursal LIMIT 1),
               n.latitud, n.longitud
        FROM negocios n
        WHERE n.latitud IS NOT NULL AND n.longitud IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sucursales sc
                          WHERE sc.id_negocio = n.id_negocio AND sc.activo = TRUE
                            AND sc.latitud IS NOT NULL AND sc.longitud IS NOT NULL)
      ) p
      WHERE p.latitud BETWEEN ? AND ? AND p.longitud BETWEEN ? AND ?
    ) d
    WHERE d.orden = 1 AND d.distancia_km <= ?
  )`;

  return {
    sql,
    values: [lng, lat, lng, lat, lat - dLat, lat + dLat, lng - dLng, lng + dLng, radio_km],
  };
};

/** Distancia en km con dos decimales (o null). */
export const redondearKm = (km) => (km === null || km === undefined ? null : Math.round(Number(km) * 100) / 100);
