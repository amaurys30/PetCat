import { z } from "zod";
import { autorizacionDatos, email, idParam, telefono } from "../../shared/utils/schemas.js";
import { createMascotaBody } from "../mascotas/mascota.schemas.js";
import { ESTADOS_CITA } from "../citas/cita.schemas.js";
import { paginationSchema } from "../../shared/utils/pagination.js";

const soloDigitos = (valor) => valor.replace(/\D/g, "");

/**
 * Búsqueda exacta por email o por teléfono (se comparan solo sus dígitos: "300 123 4567"
 * encuentra "3001234567"). Uno de los dos, no ambos.
 */
export const buscarClienteQuery = z
  .object({
    email: email.optional(),
    telefono: z
      .string()
      .transform(soloDigitos)
      .pipe(z.string().min(7, "Teléfono inválido").max(15, "Teléfono inválido"))
      .optional(),
  })
  .superRefine((q, ctx) => {
    const enviados = [q.email, q.telefono].filter((v) => v !== undefined).length;
    if (enviados !== 1) {
      ctx.addIssue({ code: "custom", path: [], message: "Envía email o telefono (solo uno)" });
    }
  });

const nombre = z.string().trim().min(2).max(80);

/** Cliente sin app registrado desde el panel, con su primera mascota. */
export const registrarClienteBody = z.strictObject({
  nombre,
  apellido: nombre,
  email,
  telefono: telefono.optional(),
  autoriza_tratamiento_datos: autorizacionDatos(
    "Se requiere la autorización del titular para el tratamiento de sus datos (Ley 1581 de 2012)"
  ),
  mascota: createMascotaBody,
});

export const agregarMascotaBody = createMascotaBody;

export const clienteParams = idParam("id_negocio").extend({ id_usuario: z.coerce.number().int().positive() });

export const listClientesQuery = paginationSchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  orden: z.enum(["ultima_cita", "nombre", "inasistencias"], { error: "Debe ser ultima_cita, nombre o inasistencias" }).default("ultima_cita"),
});

export const citasClienteQuery = paginationSchema.extend({
  estado: z
    .string()
    .transform((valor) => [...new Set(valor.split(",").map((e) => e.trim()).filter(Boolean))])
    .pipe(z.array(z.enum(ESTADOS_CITA, { error: `Estados válidos: ${ESTADOS_CITA.join(", ")}` })).min(1))
    .optional(),
});
