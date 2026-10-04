import type { Empleado } from "@/api/empleados";
import type { RolNegocio } from "@/api/roles";

export const empleadoDemo = (cambios: Partial<Empleado> = {}): Empleado => ({
  id_empleado: 1,
  id_negocio: 1,
  id_usuario: null,
  nombre: "Carlos",
  apellido: "Martínez",
  email: "carlos@petcat.test",
  telefono: null,
  documento: null,
  especialidad: null,
  titulo_profesional: null,
  registro_profesional: null,
  foto_url: null,
  foto_miniatura_url: null,
  notas: null,
  activo: true,
  fecha_vinculacion: "2026-09-01",
  fecha_retiro: null,
  fecha_creacion: "2026-09-01 10:00:00",
  fecha_actualizacion: "2026-09-01 10:00:00",
  es_propietario: false,
  tiene_cuenta: false,
  invitacion_pendiente: false,
  invitacion: { expiracion: null, envios_restantes_24h: 4, libre_desde: null },
  rol: { id_rol: 2, nombre: "Veterinario" },
  servicios: [],
  ...cambios,
});

const TODO = {
  empleados: ["ver", "crear", "editar", "eliminar"],
  roles: ["ver", "crear", "editar", "eliminar"],
  citas: ["ver", "crear", "editar", "cancelar"],
  servicios: ["ver", "crear", "editar", "eliminar"],
  configuracion: ["ver", "editar"],
};

const rol = (cambios: Partial<RolNegocio> & Pick<RolNegocio, "id_rol" | "nombre">): RolNegocio => ({
  id_negocio: null,
  descripcion: null,
  permisos_json: {},
  es_sistema: true,
  fecha_creacion: "2026-01-01 00:00:00",
  empleados_activos: 0,
  empleados_inactivos: 0,
  ...cambios,
});

/** Roles de Patitas: los tres del sistema y uno propio (Coordinador). */
export const rolesDemo: RolNegocio[] = [
  rol({
    id_rol: 1,
    nombre: "Administrador",
    descripcion: "Acceso total al panel del negocio.",
    permisos_json: TODO,
    empleados_activos: 1,
  }),
  rol({
    id_rol: 3,
    nombre: "Recepcionista",
    descripcion: "Agenda y clientes.",
    permisos_json: { citas: ["ver", "crear"], clientes: ["ver"] },
  }),
  rol({
    id_rol: 2,
    nombre: "Veterinario",
    descripcion: "Agenda, historial y vacunas.",
    permisos_json: { citas: ["ver"], historial_medico: ["ver", "crear"] },
    empleados_activos: 2,
    empleados_inactivos: 1,
  }),
  rol({
    id_rol: 9,
    id_negocio: 1,
    nombre: "Coordinador",
    descripcion: "Equipo y agenda.",
    es_sistema: false,
    permisos_json: {
      empleados: ["ver", "crear", "editar", "eliminar"],
      citas: ["ver", "crear"],
      clientes: ["ver"],
      roles: ["ver"],
    },
    empleados_activos: 1,
  }),
];

/** Catálogo de `GET /permisos` (recortado). */
export const catalogoDemo = {
  citas: ["ver", "crear", "editar", "cancelar"],
  clientes: ["ver", "editar"],
  empleados: ["ver", "crear", "editar", "eliminar"],
  roles: ["ver", "crear", "editar", "eliminar"],
  resenas: ["ver", "responder", "reportar"],
  pagos: ["ver", "ver_basico", "reembolsar"],
};
