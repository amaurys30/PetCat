// Fábrica de claves de caché de TanStack Query: un solo lugar por módulo.
// Las que empiezan por "mascotas" se guardan en el teléfono para usarlas sin red (lib/cachePersistente.ts).
export const queryKeys = {
  salud: () => ["salud"] as const,
  politicaDatos: () => ["politica-datos"] as const,
  mascotas: {
    todas: () => ["mascotas"] as const,
    lista: () => ["mascotas", "lista"] as const,
    detalle: (id_mascota: number) => ["mascotas", "detalle", id_mascota] as const,
    pesos: (id_mascota: number, meses: number) => ["mascotas", "pesos", id_mascota, meses] as const,
  },
};
