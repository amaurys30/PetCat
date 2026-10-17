/** B5 · Nueva cita: tipos y textos (sin React). */

/** Cliente elegido en B5. Sin `mascotas`, se cargan del detalle del cliente (búsqueda por nombre). */
export interface ClienteElegido {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  usa_app?: boolean;
  mascotas?: { id_mascota: number; nombre: string; especie: string }[];
  /** Línea extra de la búsqueda por nombre ("14 citas"). */
  detalle?: string;
}

export const esTelefono = (texto: string) =>
  /^[\d\s+()-]+$/.test(texto) && texto.replace(/\D/g, "").length >= 7;

/** "300 123 4567 · lorena@petcat.test · usa la app" */
export function contactoDe(c: ClienteElegido): string {
  const cuenta =
    c.email === null ? "sin cuenta" : c.usa_app === undefined ? null : c.usa_app ? "usa la app" : "sin app";
  return [c.telefono, c.email, cuenta, c.detalle].filter(Boolean).join(" · ");
}
