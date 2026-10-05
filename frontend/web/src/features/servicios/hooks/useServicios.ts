import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as serviciosApi from "@/api/servicios";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { queryKeys } from "@/lib/queryKeys";

/** Los formularios y diálogos muestran sus errores (422 por campo, 409 en línea o con sus citas). */
const meta = { avisarError: false } as const;

export function useCatalogoServicios(idNegocio: number, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.servicios.catalogo(idNegocio),
    queryFn: () => serviciosApi.getCatalogo(idNegocio),
    enabled: habilitada,
  });
}

export function useServicio(idServicio: number, habilitada = true) {
  const negocio = useNegocioActivo();
  return useQuery({
    queryKey: queryKeys.servicios.detalle(negocio.id_negocio, idServicio),
    queryFn: () => serviciosApi.getServicio(idServicio),
    enabled: habilitada,
  });
}

export function useCategoriasServicio() {
  return useQuery({
    queryKey: queryKeys.categoriasServicio(),
    queryFn: serviciosApi.getCategorias,
    staleTime: Infinity,
  });
}

/**
 * Después de cambiar un servicio: todas sus consultas (catálogo, detalle y la lista de
 * Equipo) y los empleados, que muestran los servicios que atienden. Equipo hace lo mismo
 * al revés, así las dos pantallas leen siempre lo último de `empleado_servicios`.
 */
export function useRefrescarServicios() {
  const queryClient = useQueryClient();
  const negocio = useNegocioActivo();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.servicios.todos(negocio.id_negocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.empleados.todos() }),
    ]);
}

export function useGuardarServicio() {
  const negocio = useNegocioActivo();
  const refrescar = useRefrescarServicios();
  return useMutation({
    meta,
    mutationFn: (
      datos:
        | { nuevo: serviciosApi.CrearServicioBody }
        | { idServicio: number; cambios: serviciosApi.ServicioInput },
    ) =>
      "nuevo" in datos
        ? serviciosApi.crearServicio(negocio.id_negocio, datos.nuevo)
        : serviciosApi.actualizarServicio(datos.idServicio, datos.cambios),
    onSuccess: () => refrescar(),
  });
}

/** Mostrar u ocultar en la app desde el catálogo. Los errores los avisa el manejo global. */
export function useVisibilidadServicio() {
  const refrescar = useRefrescarServicios();
  return useMutation({
    mutationFn: ({ idServicio, visible }: { idServicio: number; visible: boolean }) =>
      serviciosApi.actualizarServicio(idServicio, { visible_app: visible }),
    onSuccess: () => refrescar(),
  });
}

export function useDesactivarServicio() {
  const refrescar = useRefrescarServicios();
  return useMutation({
    meta,
    mutationFn: (idServicio: number) => serviciosApi.desactivarServicio(idServicio),
    onSuccess: () => refrescar(),
  });
}

export function useReactivarServicio() {
  const refrescar = useRefrescarServicios();
  return useMutation({
    meta,
    mutationFn: (idServicio: number) => serviciosApi.reactivarServicio(idServicio),
    // También con error: un 409 "ya está activo" significa que el catálogo estaba viejo.
    onSettled: () => refrescar(),
  });
}
