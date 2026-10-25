import type { ResenaPanel, ResumenResenas } from "@/api/resenas";

export const resenaDemo = (cambios: Partial<ResenaPanel> = {}): ResenaPanel => ({
  id_resena: 1,
  calificacion: 5,
  aspectos: { atencion: 5, precio: 4, instalaciones: null, puntualidad: 5 },
  titulo: "Excelente atención con Max",
  comentario: "El Dr. Carlos fue muy paciente y explicó todo el tratamiento.",
  fecha_creacion: "2026-08-20 18:40:00",
  fecha_edicion: null,
  editada_despues_de_respuesta: false,
  respuesta: null,
  autor: "Laura G.",
  cliente: { id_usuario: 9, nombre: "Laura", apellido: "Gómez" },
  cita: {
    id_cita: 30,
    fecha: "2026-08-18",
    servicio: { id_servicio: 1, nombre: "Consulta general" },
  },
  visible: true,
  estado: "publicada",
  retirada_en: null,
  reporte: null,
  ...cambios,
});

export const resumenDemo = (cambios: Partial<ResumenResenas> = {}): ResumenResenas => ({
  calificacion_promedio: 4.7,
  total_resenas: 38,
  distribucion: { 1: 1, 2: 1, 3: 2, 4: 6, 5: 28 },
  sin_responder: 2,
  reportadas: 1,
  ocultas: 0,
  retiradas: 0,
  ...cambios,
});

/** Respuesta paginada de `GET /negocios/1/resenas/gestion`. */
export const paginaResenas = (data: ResenaPanel[], resumen = resumenDemo(), hasNext = false) => ({
  success: true,
  message: "OK",
  data,
  meta: { total: data.length, page: 1, limit: 10, totalPages: 1, hasNext, resumen },
});
