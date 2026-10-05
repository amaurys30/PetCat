import type { CitaAfectada } from "@/api/negocios";
import type { CategoriaServicio, Servicio } from "@/api/servicios";

export const servicioDemo = (cambios: Partial<Servicio> = {}): Servicio => ({
  id_servicio: 1,
  id_negocio: 1,
  categoria: { id_categoria: 1, nombre: "Consulta y diagnóstico" },
  nombre: "Consulta general",
  descripcion: "Revisión completa.",
  indicaciones_previas: null,
  precio_base: 45000,
  precio_maximo: null,
  tipo_precio: "fijo",
  precio_actual: 45000,
  oferta_vigente: false,
  duracion_minutos: 30,
  margen_minutos: 0,
  tipo_mascota: ["perro", "gato"],
  peso_min_kg: null,
  peso_max_kg: null,
  requiere_cita: true,
  max_citas_dia: null,
  dias_disponible: null,
  visible_app: true,
  en_oferta: false,
  precio_oferta: null,
  fecha_inicio_oferta: null,
  fecha_fin_oferta: null,
  etiquetas: null,
  activo: true,
  empleados: [{ id_empleado: 1, nombre: "Carlos", apellido: "Martínez" }],
  sin_empleados: false,
  reservable: true,
  fecha_creacion: "2026-09-01 10:00:00",
  fecha_actualizacion: "2026-09-01 10:00:00",
  ...cambios,
});

export const categoriasDemo: CategoriaServicio[] = [
  {
    id_categoria: 1,
    nombre: "Consulta y diagnóstico",
    descripcion: null,
    icono: "stethoscope",
    orden_display: 1,
  },
  { id_categoria: 2, nombre: "Vacunación", descripcion: null, icono: "syringe", orden_display: 2 },
  { id_categoria: 3, nombre: "Baño y estética", descripcion: null, icono: "bath", orden_display: 3 },
];

export const citaAfectadaDemo = (cambios: Partial<CitaAfectada> = {}): CitaAfectada => ({
  id_cita: 30,
  fecha: "2026-10-12",
  hora_inicio: "09:00",
  hora_fin: "09:30",
  estado: "confirmada",
  sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
  servicio: { id_servicio: 1, nombre: "Consulta general" },
  mascota: { id_mascota: 4, nombre: "Max" },
  cliente: { id_usuario: 9, nombre: "Sofía", apellido: "Ruiz", telefono: "3001112233" },
  ...cambios,
});
