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
    // Carnet: se guardan en el teléfono para el Pasaporte sin red.
    vacunas: (id_mascota: number) => ["mascotas", "vacunas", id_mascota] as const,
    desparasitacion: (id_mascota: number) => ["mascotas", "desparasitacion", id_mascota] as const,
  },
  // Fuera de "mascotas" a propósito: diagnósticos y tratamientos no se guardan en el teléfono
  // (Ley 1581, decisión de M3). Sin red, la línea de vida muestra solo vacunas y desparasitación.
  historial: (id_mascota: number, filtro: string) => ["historial", id_mascota, filtro] as const,
};
