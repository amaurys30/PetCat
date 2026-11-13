import type { TipoExcepcion } from "@/api/disponibilidad";

/**
 * Nombres para mostrar del catálogo de permisos (`GET /permisos` solo trae las claves).
 * Una clave que no esté aquí se muestra tal cual: el catálogo manda.
 */
export const NOMBRES_MODULO: Record<string, string> = {
  citas: "Citas",
  clientes: "Clientes",
  servicios: "Servicios",
  empleados: "Empleados",
  roles: "Roles",
  historial_medico: "Historial médico",
  vacunas: "Vacunas",
  resenas: "Reseñas",
  reportes: "Reportes",
  configuracion: "Configuración",
  pagos: "Pagos",
  inventario: "Inventario",
};

export const NOMBRES_ACCION: Record<string, string> = {
  ver: "ver",
  crear: "crear",
  editar: "editar",
  eliminar: "eliminar",
  cancelar: "cancelar",
  responder: "responder",
  reportar: "reportar",
  exportar: "exportar",
  reembolsar: "reembolsar",
  ver_basico: "ver básico",
  editar_stock: "editar stock",
  // Sin ver_todas, citas.ver solo alcanza las citas propias (migración 026).
  ver_todas: "ver citas de todos",
  asignar_profesional: "registrar a nombre de otro profesional",
};

/** Columnas fijas de la matriz; "eliminar / cancelar" toma la que tenga el módulo. */
export const COLUMNAS_MATRIZ = [
  { titulo: "Ver", acciones: ["ver"] },
  { titulo: "Crear", acciones: ["crear"] },
  { titulo: "Editar", acciones: ["editar"] },
  { titulo: "Eliminar / cancelar", acciones: ["eliminar", "cancelar"] },
] as const;

export const ACCIONES_EN_COLUMNAS: readonly string[] = COLUMNAS_MATRIZ.flatMap((c) => c.acciones);

export const nombreModulo = (modulo: string) => NOMBRES_MODULO[modulo] ?? modulo;
export const nombreAccion = (accion: string) => NOMBRES_ACCION[accion] ?? accion.replaceAll("_", " ");

/** "1 activo · 2 inactivos"; sin inactivos, solo los activos. */
export function textoMiembros(activos: number, inactivos: number) {
  const a = `${activos} ${activos === 1 ? "activo" : "activos"}`;
  return inactivos > 0 ? `${a} · ${inactivos} ${inactivos === 1 ? "inactivo" : "inactivos"}` : a;
}

export const MAX_INVITACIONES_24H = 4;

export const NOMBRE_TIPO: Record<TipoExcepcion, string> = {
  bloqueo: "Bloqueo",
  vacacion: "Vacaciones",
  evento_especial: "Evento especial",
};
