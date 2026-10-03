/** Fábrica de claves de caché de TanStack Query. Todas empiezan por el recurso. */
export const queryKeys = {
  politica: () => ["politica-datos"] as const,
  invitacion: (token: string) => ["invitaciones", token] as const,
  planes: () => ["planes"] as const,
  negocios: {
    mios: () => ["negocios", "mios"] as const,
    gestion: (idNegocio: number) => ["negocios", idNegocio, "gestion"] as const,
    suscripcion: (idNegocio: number) => ["negocios", idNegocio, "suscripcion"] as const,
  },
  empleados: {
    lista: (idNegocio: number, params: object) => ["empleados", idNegocio, params] as const,
  },
};
