import type { Me, Modulo, NegocioMio, Permisos } from "@/api/types";

type Usuario = Pick<Me, "tipo_usuario"> | null | undefined;
type NegocioAcceso = Pick<NegocioMio, "relacion" | "rol" | "id_empleado"> | null | undefined;

/**
 * ¿Puede el usuario hacer `accion` en `modulo` dentro de este negocio?
 * Igual que `authorize` en la API: el admin de la plataforma y el propietario pasan
 * siempre; un empleado, si su rol tiene la acción. Solo sirve para mostrar u ocultar:
 * la API decide en cada ruta y la pantalla debe manejar el 403.
 */
export function puede(
  usuario: Usuario,
  negocio: Pick<NegocioMio, "relacion" | "rol"> | null | undefined,
  modulo: Modulo,
  accion: string,
): boolean {
  if (usuario?.tipo_usuario === "admin") return true;
  if (!negocio) return false;
  if (negocio.relacion === "propietario") return true;
  return negocio.rol?.permisos_json?.[modulo]?.includes(accion) ?? false;
}

/** La prueba Pro la activa solo el propietario del negocio (o el admin de la plataforma), como en la API. */
export function puedeActivarPrueba(
  usuario: Usuario,
  negocio: Pick<NegocioMio, "relacion"> | null | undefined,
): boolean {
  return usuario?.tipo_usuario === "admin" || negocio?.relacion === "propietario";
}

/** true si cada acción de `permisos` también está en `disponibles` (como `permisosIncluidos` de la API). */
export function permisosIncluidos(permisos: Permisos, disponibles: Permisos): boolean {
  return Object.entries(permisos).every(([modulo, acciones]) =>
    (acciones ?? []).every((accion) => disponibles[modulo]?.includes(accion) ?? false),
  );
}

/** Motivos por los que la API respondería 403 (prevención de escalada de privilegios). */
export const MOTIVOS_ESCALADA = {
  rolAjeno: "Tu rol no tiene todos los permisos de este rol",
  empleadoConMas: "Tiene permisos que tu rol no tiene",
  propioRol: "No puedes cambiar tu propio rol",
  desactivarse: "No puedes desactivarte a ti mismo",
  modificarPropioRol: "No puedes modificar tu propio rol",
  rolConMas: "Este rol tiene permisos que tu rol no tiene",
  permisoAjeno: "Tu rol no tiene este permiso: no puedes otorgarlo",
} as const;

/**
 * Reglas de escalada de la API, para deshabilitar en la interfaz lo que respondería 403.
 * Solo aplican a empleados: el propietario y el admin de la plataforma no tienen límite.
 * Cada función devuelve null si se permite, o el motivo para mostrarlo.
 */
export function reglasEscalada(usuario: Usuario, negocio: NegocioAcceso) {
  const empleado = usuario?.tipo_usuario !== "admin" && negocio?.relacion === "empleado";
  const mios: Permisos = negocio?.rol?.permisos_json ?? {};
  const miRol = negocio?.rol?.id_rol ?? null;
  const miEmpleado = negocio?.id_empleado ?? null;
  const esYo = (idEmpleado: number) => empleado && idEmpleado === miEmpleado;

  return {
    /** Puede asignar este rol a un empleado. */
    asignarRol: (permisosRol: Permisos) =>
      !empleado || permisosIncluidos(permisosRol, mios) ? null : MOTIVOS_ESCALADA.rolAjeno,
    /**
     * Puede editar, reactivar o cambiar la foto de este empleado. Sus propios datos sí
     * (no su rol). `permisosDelEmpleado` undefined: no se conocen y decide la API.
     */
    modificarEmpleado: (idEmpleado: number, permisosDelEmpleado: Permisos | undefined) => {
      if (!empleado || esYo(idEmpleado) || !permisosDelEmpleado) return null;
      return permisosIncluidos(permisosDelEmpleado, mios) ? null : MOTIVOS_ESCALADA.empleadoConMas;
    },
    cambiarRolDe: (idEmpleado: number) => (esYo(idEmpleado) ? MOTIVOS_ESCALADA.propioRol : null),
    desactivar: (idEmpleado: number) => (esYo(idEmpleado) ? MOTIVOS_ESCALADA.desactivarse : null),
    /** Puede editar o eliminar este rol propio (los del sistema no se tocan nunca). */
    modificarRol: (rol: { id_rol: number; permisos_json: Permisos }) => {
      if (!empleado) return null;
      if (rol.id_rol === miRol) return MOTIVOS_ESCALADA.modificarPropioRol;
      return permisosIncluidos(rol.permisos_json, mios) ? null : MOTIVOS_ESCALADA.rolConMas;
    },
    /** Puede otorgar esta acción en un rol. */
    otorgar: (modulo: string, accion: string) =>
      !empleado || (mios[modulo]?.includes(accion) ?? false) ? null : MOTIVOS_ESCALADA.permisoAjeno,
    esEmpleado: empleado,
    esYo,
  };
}

export type ReglasEscalada = ReturnType<typeof reglasEscalada>;
