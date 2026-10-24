import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import * as empleadosApi from "@/api/empleados";
import * as rolesApi from "@/api/roles";
import { getServicios } from "@/api/servicios";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { aviso } from "@/components/ui/toaster";
import { reglasEscalada } from "@/lib/permisos";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/stores/auth";

/** Los formularios y diálogos muestran sus errores (422 por campo, 409 en línea). */
const meta = { avisarError: false } as const;

export function useEmpleados(idNegocio: number, filtros: empleadosApi.FiltrosEmpleados, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.empleados.lista(idNegocio, filtros),
    queryFn: () => empleadosApi.getEmpleados(idNegocio, filtros),
    placeholderData: keepPreviousData,
    enabled: habilitada,
  });
}

export function useEmpleado(idEmpleado: number, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.empleados.detalle(idEmpleado),
    queryFn: () => empleadosApi.getEmpleado(idEmpleado),
    enabled: habilitada,
  });
}

export function useRoles(idNegocio: number, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.roles(idNegocio),
    queryFn: () => rolesApi.getRoles(idNegocio),
    enabled: habilitada,
  });
}

export function useCatalogoPermisos() {
  return useQuery({
    queryKey: queryKeys.catalogoPermisos(),
    queryFn: rolesApi.getCatalogoPermisos,
    staleTime: Infinity,
  });
}

/** Servicios activos para asignar (servicios.ver). Hasta 100: más que eso no cabe en chips. */
export function useServiciosActivos(idNegocio: number, habilitada = true) {
  const params = { activo: true, limit: 100 };
  return useQuery({
    queryKey: queryKeys.servicios.lista(idNegocio, params),
    queryFn: () => getServicios(idNegocio, params),
    enabled: habilitada,
    select: (pagina) => pagina.data,
  });
}

/** Reglas de escalada del usuario en el negocio activo. */
export function useEscalada() {
  const usuario = useAuth((s) => s.usuario);
  const negocio = useNegocioActivo();
  return useMemo(() => reglasEscalada(usuario, negocio), [usuario, negocio]);
}

/**
 * Permisos de cada rol del negocio por id, para aplicar las reglas de escalada a una fila
 * del equipo (el listado no trae los permisos del rol). Vacío si no se pueden consultar.
 */
export function usePermisosPorRol() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const escalada = useEscalada();
  const consultar =
    escalada.esEmpleado &&
    (puede("roles", "ver") || puede("empleados", "crear") || puede("empleados", "editar"));
  const roles = useRoles(negocio.id_negocio, consultar);
  return useMemo(() => new Map((roles.data ?? []).map((r) => [r.id_rol, r.permisos_json])), [roles.data]);
}

/**
 * Después de cambiar el equipo: listas, detalles, roles (cuentan miembros), servicios
 * (cuentan profesionales), la suscripción (uso del límite) y el perfil (`id_empleado` del
 * propietario en `/auth/me`).
 */
export function useRefrescarEquipo() {
  const queryClient = useQueryClient();
  const negocio = useNegocioActivo();
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  return async ({ perfil = false } = {}) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.empleados.todos() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roles(negocio.id_negocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.servicios.todos(negocio.id_negocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.negocios.suscripcion(negocio.id_negocio) }),
      // El cambio ya se guardó: si el perfil no se recarga ahora, se recarga en la siguiente visita.
      perfil ? recargarUsuario().catch(() => undefined) : undefined,
    ]);
  };
}

export function useCrearEmpleado() {
  const negocio = useNegocioActivo();
  return useMutation({
    meta,
    mutationFn: (body: empleadosApi.CrearEmpleadoBody) =>
      empleadosApi.crearEmpleado(negocio.id_negocio, body),
  });
}

export function useActualizarEmpleado() {
  return useMutation({
    meta,
    mutationFn: ({ idEmpleado, body }: { idEmpleado: number; body: empleadosApi.ActualizarEmpleadoBody }) =>
      empleadosApi.actualizarEmpleado(idEmpleado, body),
  });
}

export function useDesactivarEmpleado() {
  const refrescar = useRefrescarEquipo();
  return useMutation({
    meta,
    mutationFn: (idEmpleado: number) => empleadosApi.desactivarEmpleado(idEmpleado),
    onSuccess: () => refrescar(),
  });
}

/** El 403 del límite del plan abre su diálogo (manejo global). */
export function useReactivarEmpleado() {
  const refrescar = useRefrescarEquipo();
  return useMutation({
    mutationFn: (idEmpleado: number) => empleadosApi.reactivarEmpleado(idEmpleado),
    onSuccess: () => refrescar(),
  });
}

export function useRegistrarme() {
  const negocio = useNegocioActivo();
  const refrescar = useRefrescarEquipo();
  return useMutation({
    meta,
    mutationFn: (body: empleadosApi.EmpleadoPropioBody) =>
      empleadosApi.registrarmeComoEmpleado(negocio.id_negocio, body),
    onSuccess: () => refrescar({ perfil: true }),
  });
}

/** Envía o reenvía según haya una invitación vigente. Los 409 y 503 los muestra el aviso global. */
/**
 * Envía o reenvía la invitación. El aviso va aquí y no en la llamada a `mutate`: el hook vive
 * en la fila, y si la lista se vuelve a pintar mientras tanto (una búsqueda, otra recarga)
 * la fila se monta de nuevo y TanStack descarta los callbacks de esa llamada.
 */
export function useInvitar() {
  const refrescar = useRefrescarEquipo();
  return useMutation({
    mutationFn: ({ idEmpleado, reenviar }: { idEmpleado: number; reenviar: boolean }) =>
      reenviar ? empleadosApi.reenviarInvitacion(idEmpleado) : empleadosApi.enviarInvitacion(idEmpleado),
    onSuccess: (enviada, { reenviar }) =>
      aviso.exito(
        `Invitación ${reenviar ? "reenviada" : "enviada"} a ${enviada.email}. ${
          enviada.envios_restantes_24h === 0
            ? "No quedan más envíos por hoy."
            : `Puedes enviarle ${enviada.envios_restantes_24h} más en 24 horas.`
        }`,
      ),
    onSettled: () => refrescar(),
  });
}

export function useFotoEmpleado(idEmpleado: number) {
  const refrescar = useRefrescarEquipo();
  const subir = useMutation({
    meta,
    mutationFn: ({ archivo, onProgreso }: { archivo: File; onProgreso: (p: number) => void }) =>
      empleadosApi.subirFotoEmpleado(idEmpleado, archivo, onProgreso),
    onSuccess: () => refrescar(),
  });
  const quitar = useMutation({
    meta,
    mutationFn: () => empleadosApi.quitarFotoEmpleado(idEmpleado),
    onSuccess: () => refrescar(),
  });
  return { subir, quitar };
}

export function useGuardarRol() {
  const negocio = useNegocioActivo();
  const refrescar = useRefrescarEquipo();
  return useMutation({
    meta,
    mutationFn: (
      datos: { nuevo: rolesApi.CrearRolBody } | { idRol: number; cambios: rolesApi.ActualizarRolBody },
    ) =>
      "nuevo" in datos
        ? rolesApi.crearRol(negocio.id_negocio, datos.nuevo)
        : rolesApi.actualizarRol(datos.idRol, datos.cambios),
    // Los permisos del propio rol también llegan en /auth/me.
    onSuccess: () => refrescar({ perfil: true }),
  });
}

export function useEliminarRol() {
  const refrescar = useRefrescarEquipo();
  return useMutation({
    meta,
    mutationFn: (idRol: number) => rolesApi.eliminarRol(idRol),
    onSuccess: () => refrescar(),
  });
}
