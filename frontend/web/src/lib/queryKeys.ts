/** Fábrica de claves de caché de TanStack Query. Todas empiezan por el recurso. */
export const queryKeys = {
  negocios: {
    mios: () => ["negocios", "mios"] as const,
    suscripcion: (idNegocio: number) => ["negocios", idNegocio, "suscripcion"] as const,
  },
};
