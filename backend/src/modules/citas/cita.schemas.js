import { z } from "zod";
import { fecha, hora, texto } from "../../shared/utils/schemas.js";

const id = z.number().int().positive();
const idQuery = z.coerce.number().int().positive();

export const ORIGENES_PANEL = ["panel_web", "presencial", "telefono", "whatsapp"];
export const PRIORIDADES = ["normal", "alta", "urgente"];

export const horariosLibresQuery = z.object({
  id_servicio: idQuery,
  id_sucursal: idQuery,
  fecha,
  id_empleado: idQuery.optional(),
});

const campos = {
  id_servicio: id,
  id_sucursal: id,
  fecha,
  hora_inicio: hora,
  id_mascota: id,
  id_empleado: id.optional(),
  notas_cliente: texto(2000).optional(),
};

/** Reserva desde la app: la mascota debe ser del usuario autenticado. */
export const createCitaBody = z.strictObject(campos);

/** Reserva desde el panel para un cliente (id_usuario) y su mascota. */
export const createCitaPanelBody = z.strictObject({
  ...campos,
  id_usuario: id,
  origen: z.enum(ORIGENES_PANEL, { error: `Debe ser uno de: ${ORIGENES_PANEL.join(", ")}` }).default("panel_web"),
  prioridad: z.enum(PRIORIDADES, { error: `Debe ser una de: ${PRIORIDADES.join(", ")}` }).default("normal"),
  notas_internas: texto(2000).optional(),
});
