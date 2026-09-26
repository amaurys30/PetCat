import { z } from "zod";

/**
 * Catálogo de permisos del panel: módulo -> acciones posibles. Es la fuente de
 * verdad para validar `roles.permisos_json`, para `authorize(modulo, accion)` y
 * para el editor de roles (GET /permisos). Sucursales, horarios, disponibilidad
 * y datos del negocio usan `configuracion`.
 * Si cambia, revisar los roles del sistema en database/petcat.sql.
 */
export const CATALOGO_PERMISOS = Object.freeze({
  citas: ["ver", "crear", "editar", "cancelar"],
  servicios: ["ver", "crear", "editar", "eliminar"],
  inventario: ["ver", "crear", "editar", "eliminar", "editar_stock"],
  clientes: ["ver", "editar"],
  empleados: ["ver", "crear", "editar", "eliminar"],
  pagos: ["ver", "ver_basico", "reembolsar"],
  roles: ["ver", "crear", "editar", "eliminar"],
  reportes: ["ver", "exportar"],
  configuracion: ["ver", "editar"],
  historial_medico: ["ver", "crear", "editar"],
  vacunas: ["ver", "crear", "editar"],
});

export const existePermiso = (modulo, accion) =>
  Object.hasOwn(CATALOGO_PERMISOS, modulo) && CATALOGO_PERMISOS[modulo].includes(accion);

/**
 * Esquema Zod de `permisos_json`: solo módulos y acciones del catálogo.
 * Quita acciones repetidas y módulos sin acciones.
 */
export const permisosSchema = z
  .strictObject(
    Object.fromEntries(
      Object.entries(CATALOGO_PERMISOS).map(([modulo, acciones]) => [
        modulo,
        z.array(z.enum(acciones)).optional(),
      ])
    )
  )
  .transform((permisos) =>
    Object.fromEntries(
      Object.entries(permisos)
        .filter(([, acciones]) => acciones?.length)
        .map(([modulo, acciones]) => [modulo, [...new Set(acciones)]])
    )
  );

const parsePermisos = (permisos) => {
  if (!permisos) return {};
  if (typeof permisos !== "string") return permisos;
  try {
    return JSON.parse(permisos);
  } catch {
    return {};
  }
};

export const hasPermission = (permisos, modulo, accion) =>
  parsePermisos(permisos)[modulo]?.includes(accion) ?? false;

/** true si cada acción de `permisos` también está en `disponibles`. */
export const permisosIncluidos = (permisos, disponibles) =>
  Object.entries(parsePermisos(permisos)).every(([modulo, acciones]) =>
    (acciones ?? []).every((accion) => hasPermission(disponibles, modulo, accion))
  );
