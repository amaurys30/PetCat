// Cita en los resúmenes de salud (por mascota y en lote): la consulta base y su formato.

export const SELECT_CITA = `SELECT c.id_cita, c.id_mascota, c.fecha, TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio, c.estado,
         sv.id_servicio, sv.nombre AS servicio_nombre, n.id_negocio, n.nombre AS negocio_nombre
  FROM citas c
  JOIN servicios sv ON sv.id_servicio = c.id_servicio
  JOIN negocios n ON n.id_negocio = c.id_negocio`;

export const formatCitaResumen = (c) =>
  c && {
    id_cita: c.id_cita,
    fecha: c.fecha,
    hora_inicio: c.hora_inicio,
    estado: c.estado,
    servicio: { id_servicio: c.id_servicio, nombre: c.servicio_nombre },
    negocio: { id_negocio: c.id_negocio, nombre: c.negocio_nombre },
  };
