import { z } from "zod";
import {
  MAX_BYTES_ARCHIVO,
  TIPOS_ARCHIVO,
  TIPOS_HISTORIAL,
  type CambiosRegistro,
  type NuevoRegistro,
  type RegistroHistorial,
} from "@/api/salud";
import { hoyISO } from "@/lib/format";

const texto = z.string().max(2000, "Máximo 2000 caracteres");

/** "28,4" o "28.4" -> 28.4; vacío -> null. */
export const aNumero = (valor: string): number | null => {
  const limpio = valor.trim().replace(",", ".");
  return limpio === "" ? null : Number(limpio);
};

const numero = (min: number, max: number, mensaje: string, { entero = false } = {}) =>
  z.string().refine((v) => {
    const n = aNumero(v);
    return n === null || (Number.isFinite(n) && n >= min && n <= max && (!entero || Number.isInteger(n)));
  }, mensaje);

/** Mismas reglas que la API (historial.schemas.js del backend). */
export const registroSchema = z
  .object({
    tipo: z.enum(TIPOS_HISTORIAL, { error: "Elige el tipo" }),
    idCita: z.string(),
    fecha: z
      .string()
      .min(1, "Elige la fecha")
      .refine((f) => f <= hoyISO(), "No puede ser una fecha futura"),
    idEmpleado: z.string(),
    motivo: texto,
    diagnostico: texto,
    tratamiento: texto,
    medicamentos: texto,
    indicaciones: texto,
    peso: numero(0.01, 9999.99, "Peso entre 0,01 y 9.999,99 kg"),
    temperatura: numero(25, 45, "Temperatura entre 25 y 45 °C"),
    fc: numero(1, 500, "Entre 1 y 500 latidos por minuto", { entero: true }),
    fr: numero(1, 300, "Entre 1 y 300 respiraciones por minuto", { entero: true }),
    proximoControl: z.string(),
    notasInternas: texto,
  })
  .refine((v) => !v.proximoControl || v.proximoControl >= v.fecha, {
    path: ["proximoControl"],
    message: "No puede ser anterior a la fecha del registro",
  });

export type RegistroValores = z.infer<typeof registroSchema>;

/** Campo del formulario de cada campo de la API (para mostrar los 422 donde corresponden). */
export const CAMPO_DE_API: Record<string, keyof RegistroValores> = {
  tipo: "tipo",
  id_cita: "idCita",
  fecha: "fecha",
  id_empleado: "idEmpleado",
  motivo_consulta: "motivo",
  diagnostico: "diagnostico",
  tratamiento: "tratamiento",
  medicamentos_prescritos: "medicamentos",
  indicaciones: "indicaciones",
  peso_registro: "peso",
  temperatura: "temperatura",
  frecuencia_cardiaca: "fc",
  frecuencia_respiratoria: "fr",
  proximo_control: "proximoControl",
  notas_internas: "notasInternas",
};

const textoOVacio = (v: string | null | undefined) => v ?? "";
const numeroOVacio = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

export function valoresDe(registro: RegistroHistorial): RegistroValores {
  return {
    tipo: registro.tipo as RegistroValores["tipo"],
    idCita: registro.id_cita ? String(registro.id_cita) : "",
    fecha: registro.fecha,
    idEmpleado: registro.empleado ? String(registro.empleado.id_empleado) : "",
    motivo: textoOVacio(registro.motivo_consulta),
    diagnostico: textoOVacio(registro.diagnostico),
    tratamiento: textoOVacio(registro.tratamiento),
    medicamentos: textoOVacio(registro.medicamentos_prescritos),
    indicaciones: textoOVacio(registro.indicaciones),
    peso: numeroOVacio(registro.peso_registro),
    temperatura: numeroOVacio(registro.temperatura),
    fc: numeroOVacio(registro.frecuencia_cardiaca),
    fr: numeroOVacio(registro.frecuencia_respiratoria),
    proximoControl: textoOVacio(registro.proximo_control),
    notasInternas: textoOVacio(registro.notas_internas),
  };
}

const nulo = (v: string) => (v.trim() === "" ? null : v.trim());

/** Campos de la API (sin mascota ni cita); vacío = null. */
function camposApi(v: RegistroValores) {
  return {
    tipo: v.tipo,
    fecha: v.fecha,
    id_empleado: v.idEmpleado ? Number(v.idEmpleado) : null,
    motivo_consulta: nulo(v.motivo),
    diagnostico: nulo(v.diagnostico),
    tratamiento: nulo(v.tratamiento),
    medicamentos_prescritos: nulo(v.medicamentos),
    indicaciones: nulo(v.indicaciones),
    peso_registro: aNumero(v.peso),
    temperatura: aNumero(v.temperatura),
    frecuencia_cardiaca: aNumero(v.fc),
    frecuencia_respiratoria: aNumero(v.fr),
    proximo_control: nulo(v.proximoControl),
    notas_internas: nulo(v.notasInternas),
  };
}

/** Nuevo registro: sin los campos vacíos (sin profesional, la API pone el perfil de quien registra). */
export function nuevoRegistroApi(v: RegistroValores, idMascota: number): NuevoRegistro {
  const campos = Object.fromEntries(Object.entries(camposApi(v)).filter(([, valor]) => valor !== null));
  return {
    ...campos,
    id_mascota: idMascota,
    ...(v.idCita && { id_cita: Number(v.idCita) }),
  } as NuevoRegistro;
}

/** Edición: solo los campos que cambiaron (vaciar uno lo envía en null). */
export function cambiosApi(v: RegistroValores, original: RegistroValores): CambiosRegistro {
  const nuevos = camposApi(v);
  const antes = camposApi(original);
  return Object.fromEntries(
    Object.entries(nuevos).filter(([campo, valor]) => antes[campo as keyof typeof antes] !== valor),
  ) as CambiosRegistro;
}

/** Problema de un archivo antes de subirlo (formato o tamaño), o null. */
export function problemaArchivo(archivo: File): string | null {
  if (!TIPOS_ARCHIVO.includes(archivo.type)) return `${archivo.name}: solo JPG, PNG, WebP o PDF`;
  if (archivo.size > MAX_BYTES_ARCHIVO) return `${archivo.name}: pesa más de 10 MB`;
  return null;
}
