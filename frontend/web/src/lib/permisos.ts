import type { Me, Modulo, NegocioMio } from "@/api/types";

/**
 * ¿Puede el usuario hacer `accion` en `modulo` dentro de este negocio?
 * Igual que `authorize` en la API: el admin de la plataforma y el propietario pasan
 * siempre; un empleado, si su rol tiene la acción. Solo sirve para mostrar u ocultar:
 * la API decide en cada ruta y la pantalla debe manejar el 403.
 */
export function puede(
  usuario: Pick<Me, "tipo_usuario"> | null | undefined,
  negocio: Pick<NegocioMio, "relacion" | "rol"> | null | undefined,
  modulo: Modulo,
  accion: string,
): boolean {
  if (usuario?.tipo_usuario === "admin") return true;
  if (!negocio) return false;
  if (negocio.relacion === "propietario") return true;
  return negocio.rol?.permisos_json?.[modulo]?.includes(accion) ?? false;
}
