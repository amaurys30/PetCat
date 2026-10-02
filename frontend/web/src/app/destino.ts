import type { Me } from "@/api/types";

/** A dónde ir después de entrar: directo al panel si tiene un solo negocio; si no, al selector (A5). */
export function destinoInicial(usuario: Pick<Me, "negocios">, desde?: string | null): string {
  if (desde?.startsWith("/n/")) {
    const id = Number(desde.split("/")[2]);
    if (usuario.negocios.some((n) => n.id_negocio === id)) return desde;
  }
  const [unico, ...otros] = usuario.negocios;
  return unico && otros.length === 0 ? `/n/${unico.id_negocio}` : "/negocios";
}
