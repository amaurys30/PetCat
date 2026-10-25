import type { Me } from "@/api/types";

/**
 * A dónde ir después de entrar: directo al panel si tiene un solo negocio; si no, al selector
 * (A5). El super admin sin negocios va a la administración (/admin).
 */
export function destinoInicial(
  usuario: Pick<Me, "negocios" | "tipo_usuario">,
  desde?: string | null,
): string {
  const admin = usuario.tipo_usuario === "admin";
  if (desde?.startsWith("/n/")) {
    const id = Number(desde.split("/")[2]);
    if (usuario.negocios.some((n) => n.id_negocio === id)) return desde;
  }
  if (admin && desde?.startsWith("/admin")) return desde;
  if (admin && usuario.negocios.length === 0) return "/admin";
  const [unico, ...otros] = usuario.negocios;
  return unico && otros.length === 0 ? `/n/${unico.id_negocio}` : "/negocios";
}
