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
    /** Con el prefijo ["empleados"]: guardar un miembro también la recarga. */
    profesionales: (idNegocio: number) => ["empleados", idNegocio, "profesionales"] as const,
  },
  /** Todas empiezan por ["citas", idNegocio]: un cambio en una cita recarga la agenda y la atención. */
  citas: {
    todas: (idNegocio: number) => ["citas", idNegocio] as const,
    agenda: (idNegocio: number, filtros: object) => ["citas", idNegocio, "agenda", filtros] as const,
    atencion: (idNegocio: number, filtros: object) => ["citas", idNegocio, "atencion", filtros] as const,
    detalle: (idNegocio: number, idCita: number) => ["citas", idNegocio, "detalle", idCita] as const,
    historial: (idNegocio: number, idCita: number) => ["citas", idNegocio, "historial", idCita] as const,
    libres: (idNegocio: number, idCita: number) => ["citas", idNegocio, "libres", idCita] as const,
    horarios: (idNegocio: number, consulta: object) => ["citas", idNegocio, "horarios", consulta] as const,
    /** Citas de una mascota con el negocio (ficha de la mascota). */
    mascota: (idNegocio: number, idMascota: number) => ["citas", idNegocio, "mascota", idMascota] as const,
  },
  roles: (idNegocio: number) => ["roles", idNegocio] as const,
  /** Todas empiezan por ["dashboard", idNegocio]: cambiar de plan las recarga. */
  dashboard: {
    todo: (idNegocio: number) => ["dashboard", idNegocio] as const,
  },
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
  clientes: {
    todos: (idNegocio: number) => ["clientes", idNegocio] as const,
    lista: (idNegocio: number, params: object) => ["clientes", idNegocio, "lista", params] as const,
    detalle: (idNegocio: number, idUsuario: number) => ["clientes", idNegocio, "detalle", idUsuario] as const,
    citas: (idNegocio: number, idUsuario: number) => ["clientes", idNegocio, "citas", idUsuario] as const,
    notas: (idNegocio: number, idUsuario: number) => ["clientes", idNegocio, "notas", idUsuario] as const,
    /** Búsqueda del Topbar (clientes y mascotas por nombre, correo o teléfono). */
    busqueda: (idNegocio: number, q: string) => ["clientes", idNegocio, "busqueda", q] as const,
  },
  /** Ficha de la mascota: todas empiezan por ["salud", idNegocio, idMascota]. */
  salud: {
    todo: (idNegocio: number) => ["salud", idNegocio] as const,
    resumen: (idNegocio: number, idMascota: number) => ["salud", idNegocio, idMascota, "resumen"] as const,
    historial: (idNegocio: number, idMascota: number, filtros: object) =>
      ["salud", idNegocio, idMascota, "historial", filtros] as const,
    vacunas: (idNegocio: number, idMascota: number) => ["salud", idNegocio, idMascota, "vacunas"] as const,
  },
  disponibilidad: {
    todo: (idEmpleado: number) => ["disponibilidad", idEmpleado] as const,
    efectiva: (idEmpleado: number, fecha: string) =>
      ["disponibilidad", idEmpleado, "efectiva", fecha] as const,
    /** Excepciones que cubren un día (vista Día de la agenda). */
    delDia: (idEmpleado: number, fecha: string) => ["disponibilidad", idEmpleado, "dia", fecha] as const,
  },
};
