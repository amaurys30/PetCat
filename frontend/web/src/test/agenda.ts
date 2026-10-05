import type { CitaPanel } from "@/api/citas";
import type { Profesional } from "@/api/empleados";

export const citaPanelDemo = (cambios: Partial<CitaPanel> = {}): CitaPanel => ({
  id_cita: 100,
  fecha: "2026-10-05",
  hora_inicio: "09:00",
  hora_fin: "09:30",
  estado: "confirmada",
  origen: "app_movil",
  prioridad: "normal",
  precio_estimado: 60000,
  precio_final: null,
  notas_cliente: null,
  notas_internas: null,
  id_cita_origen: null,
  confirmar_antes_de: null,
  fecha_completada: null,
  id_resena: null,
  cancelacion: null,
  negocio: { id_negocio: 1, nombre: "Clínica Veterinaria Patitas", logo_url: null },
  sucursal: {
    id_sucursal: 3,
    nombre: "Sede Centro",
    direccion: "Cra 19 #22-35",
    telefono: null,
    latitud: null,
    longitud: null,
  },
  servicio: { id_servicio: 1, nombre: "Consulta general", duracion_minutos: 30 },
  empleado: { id_empleado: 1, nombre: "Carlos", apellido: "Pérez" },
  mascota: { id_mascota: 4, nombre: "Max", especie: "perro" },
  cliente: { id_usuario: 9, nombre: "Sofía", apellido: "Gómez", telefono: "3001112233" },
  fecha_creacion: "2026-10-01 10:00:00",
  fuera_de_disponibilidad: false,
  motivo_fuera: null,
  ...cambios,
});

export const profesionalDemo = (cambios: Partial<Profesional> = {}): Profesional => ({
  id_empleado: 1,
  nombre: "Carlos",
  apellido: "Pérez",
  especialidad: "Medicina de pequeños animales",
  foto_url: null,
  foto_miniatura_url: null,
  rol: { id_rol: 2, nombre: "Veterinario" },
  servicios: [{ id_servicio: 1, nombre: "Consulta general" }],
  ...cambios,
});

/** Horario partido de lunes a viernes y sábado en la mañana (como la Sede Centro del seed). */
export const horarioPartido = [1, 2, 3, 4, 5]
  .flatMap((d) => [
    { dia_semana: d, hora_apertura: "08:00", hora_cierre: "12:00" },
    { dia_semana: d, hora_apertura: "14:00", hora_cierre: "18:00" },
  ])
  .concat([{ dia_semana: 6, hora_apertura: "08:00", hora_cierre: "12:00" }]);
