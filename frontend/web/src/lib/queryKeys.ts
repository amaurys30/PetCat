/** Fábrica de claves de caché de TanStack Query. Todas empiezan por el recurso. */
export const queryKeys = {
  politica: () => ["politica-datos"] as const,
  invitacion: (token: string) => ["invitaciones", token] as const,
  negocios: {
    mios: () => ["negocios", "mios"] as const,
    suscripcion: (idNegocio: number) => ["negocios", idNegocio, "suscripcion"] as const,
  },
};
