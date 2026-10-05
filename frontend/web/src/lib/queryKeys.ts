/** Fábrica de claves de caché de TanStack Query. Todas empiezan por el recurso. */
export const queryKeys = {
  politica: () => ["politica-datos"] as const,
  invitacion: (token: string) => ["invitaciones", token] as const,
  planes: () => ["planes"] as const,
  negocios: {
    mios: () => ["negocios", "mios"] as const,
    gestion: (idNegocio: number) => ["negocios", idNegocio, "gestion"] as const,
    suscripcion: (idNegocio: number) => ["negocios", idNegocio, "suscripcion"] as const,
    publico: (idNegocio: number) => ["negocios", idNegocio, "publico"] as const,
  },
  empleados: {
    /** Prefijo de todas las consultas de empleados (listas y detalles). */
    todos: () => ["empleados"] as const,
    lista: (idNegocio: number, params: object) => ["empleados", idNegocio, params] as const,
    detalle: (idEmpleado: number) => ["empleados", "detalle", idEmpleado] as const,
  },
  roles: (idNegocio: number) => ["roles", idNegocio] as const,
  catalogoPermisos: () => ["permisos"] as const,
  /** Todas empiezan por ["servicios", idNegocio]: Equipo las recarga con ese prefijo. */
  servicios: {
    todos: (idNegocio: number) => ["servicios", idNegocio] as const,
    lista: (idNegocio: number, params: object) => ["servicios", idNegocio, params] as const,
    catalogo: (idNegocio: number) => ["servicios", idNegocio, "catalogo"] as const,
    detalle: (idNegocio: number, idServicio: number) =>
      ["servicios", idNegocio, "detalle", idServicio] as const,
  },
  categoriasServicio: () => ["categorias-servicio"] as const,
  disponibilidad: {
    todo: (idEmpleado: number) => ["disponibilidad", idEmpleado] as const,
    efectiva: (idEmpleado: number, fecha: string) =>
      ["disponibilidad", idEmpleado, "efectiva", fecha] as const,
  },
};
