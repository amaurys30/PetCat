import { z } from "zod";

/**
 * Catálogo de permisos del panel: módulo -> acciones posibles. Es la fuente de
 * verdad para validar `roles.permisos_json`, para `authorize(modulo, accion)` y
 * para el editor de roles (GET /permisos). Sucursales, horarios, disponibilidad
 * y datos del negocio usan `configuracion`.
 * Si cambia, revisar los roles del sistema en database/petcat.sql.
 */
export const CATALOGO_PERMISOS = Object.freeze({
  // Sin ver_todas, citas.ver solo alcanza las citas propias (migración 026).
  citas: ["ver", "ver_todas", "crear", "editar", "cancelar"],
  servicios: ["ver", "crear", "editar", "eliminar"],
  inventario: ["ver", "crear", "editar", "eliminar", "editar_stock"],
  clientes: ["ver", "editar"],
  empleados: ["ver", "crear", "editar", "eliminar"],
  pagos: ["ver", "ver_basico", "reembolsar"],
  roles: ["ver", "crear", "editar", "eliminar"],
  reportes: ["ver", "exportar"],
  configuracion: ["ver", "editar"],
  // asignar_profesional: registrar a nombre de otro profesional (migración 026).
  historial_medico: ["ver", "crear", "editar", "asignar_profesional"],
  vacunas: ["ver", "crear", "editar"],
  // Responder es hablar en público en nombre del negocio (migración 018).
  resenas: ["ver", "responder", "reportar"],
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

export const parsePermisos = (permisos) => {
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

/**
 * El acceso al panel que dejó authorize (`req.acceso`) tiene el permiso: el admin de
 * plataforma y el propietario siempre; un empleado, según su rol.
 */
export const accesoPermite = (acceso, modulo, accion) =>
  acceso?.relacion === "admin" ||
  acceso?.relacion === "propietario" ||
  (acceso?.relacion === "empleado" && hasPermission(acceso.permisos, modulo, accion));

/**
 * El acceso ve y gestiona las citas de todos los profesionales (citas.ver_todas). Sin el
 * permiso, solo las de su perfil de empleado (`acceso.id_empleado`).
 */
export const veTodasLasCitas = (acceso) => accesoPermite(acceso, "citas", "ver_todas");

/** true si cada acción de `permisos` también está en `disponibles`. */
export const permisosIncluidos = (permisos, disponibles) =>
  Object.entries(parsePermisos(permisos)).every(([modulo, acciones]) =>
    (acciones ?? []).every((accion) => hasPermission(disponibles, modulo, accion))
  );
