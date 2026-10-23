import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/salud";
import { vigenciaRestante } from "@/lib/archivos";
import { queryKeys } from "@/lib/queryKeys";

const POR_PAGINA = 10;

const siguiente = ({ meta }: { meta: { page: number; hasNext: boolean } }) =>
  meta.hasNext ? meta.page + 1 : undefined;

/** Cabecera y resumen de la ficha. El 403 (sin cita válida) lo muestra la página. */
export function useResumenSalud(idNegocio: number, idMascota: number) {
  return useQuery({
    queryKey: queryKeys.salud.resumen(idNegocio, idMascota),
    queryFn: () => api.getResumenSalud(idNegocio, idMascota),
  });
}

/**
 * Historial de la mascota, de 10 en 10. Queda viejo cuando está por vencer la primera URL
 * firmada de sus archivos, así al volver a la pestaña se pide de nuevo.
 */
export function useHistorial(
  idNegocio: number,
  idMascota: number,
  filtros: api.FiltrosHistorial,
  habilitada: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.salud.historial(idNegocio, idMascota, filtros),
    queryFn: ({ pageParam }) =>
      api.getHistorial(idNegocio, idMascota, { ...filtros, page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: habilitada,
    staleTime: (q) =>
      vigenciaRestante(q.state.data?.pages.flatMap((p) => p.data.flatMap((r) => r.archivos)) ?? []),
  });
}

/** Carnet completo (todas las dosis). Queda viejo cuando está por vencer un comprobante. */
export function useVacunas(idNegocio: number, idMascota: number, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.salud.vacunas(idNegocio, idMascota),
    queryFn: () => api.getVacunas(idNegocio, idMascota),
    enabled: habilitada,
    staleTime: (q) =>
      vigenciaRestante((q.state.data ?? []).flatMap((v) => (v.comprobante ? [v.comprobante] : []))),
  });
}

/**
 * Citas de la mascota con el negocio (citas.ver o clientes.ver). Con `estado` ("en_curso,completada")
 * solo esas: así las futuras y las canceladas no ocupan la primera página.
 */
export function useCitasMascota(idNegocio: number, idMascota: number, habilitada: boolean, estado?: string) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.citas.mascota(idNegocio, idMascota), estado ?? "todas"],
    queryFn: ({ pageParam }) =>
      api.getCitasMascota(idNegocio, idMascota, { page: pageParam, limit: 20, ...(estado && { estado }) }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: habilitada,
  });
}

/** Guardar un registro recarga la ficha (historial, resumen y peso) y las citas (B4 y sus registros). */
function useRecargarSalud(idNegocio: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.salud.todo(idNegocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.citas.todas(idNegocio) }),
    ]);
}

/** El diálogo muestra sus errores (422 por campo). */
const meta = { avisarError: false } as const;

export function useCrearRegistro(idNegocio: number) {
  const recargar = useRecargarSalud(idNegocio);
  return useMutation({
    meta,
    mutationFn: (body: api.NuevoRegistro) => api.crearRegistro(idNegocio, body),
    onSuccess: recargar,
  });
}

export function useEditarRegistro(idNegocio: number) {
  const recargar = useRecargarSalud(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idHistorial, cambios }: { idHistorial: number; cambios: api.CambiosRegistro }) =>
      api.editarRegistro(idHistorial, cambios),
    onSuccess: recargar,
  });
}

/**
 * Sube los archivos de a 5 (lo que admite la API por envío), uno tras otro. Si un envío
 * falla, los anteriores ya quedaron: el error trae cuántos se subieron.
 */
export function useSubirArchivos(idNegocio: number) {
  const recargar = useRecargarSalud(idNegocio);
  return useMutation({
    meta,
    mutationFn: async ({ idHistorial, archivos }: { idHistorial: number; archivos: File[] }) => {
      let registro: api.RegistroHistorial | undefined;
      for (let i = 0; i < archivos.length; i += api.ARCHIVOS_POR_ENVIO) {
        try {
          registro = await api.subirArchivosRegistro(
            idHistorial,
            archivos.slice(i, i + api.ARCHIVOS_POR_ENVIO),
          );
        } catch (error) {
          throw Object.assign(error as Error, { subidos: i });
        }
      }
      return registro;
    },
    onSettled: recargar,
  });
}

export function useEliminarArchivo(idNegocio: number) {
  const recargar = useRecargarSalud(idNegocio);
  return useMutation({
    mutationFn: ({ idHistorial, idArchivo }: { idHistorial: number; idArchivo: number }) =>
      api.eliminarArchivoRegistro(idHistorial, idArchivo),
    onSuccess: recargar,
  });
}

// ---------- Vacunas (C5) ----------

/** Guardar una vacuna recarga el carnet, el resumen (vencidas y próximas) y el historial. */
function useRecargarFicha(idNegocio: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.salud.todo(idNegocio) });
}

export function useCrearVacuna(idNegocio: number) {
  const recargar = useRecargarFicha(idNegocio);
  return useMutation({
    meta,
    mutationFn: (body: api.NuevaVacuna) => api.crearVacuna(idNegocio, body),
    onSuccess: recargar,
  });
}

export function useEditarVacuna(idNegocio: number) {
  const recargar = useRecargarFicha(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idVacuna, cambios }: { idVacuna: number; cambios: api.CambiosVacuna }) =>
      api.editarVacuna(idVacuna, cambios),
    onSuccess: recargar,
  });
}

export function useSubirComprobante(idNegocio: number) {
  const recargar = useRecargarFicha(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idVacuna, archivo }: { idVacuna: number; archivo: File }) =>
      api.subirComprobante(idVacuna, archivo),
    onSettled: recargar,
  });
}

export function useEliminarComprobante(idNegocio: number) {
  const recargar = useRecargarFicha(idNegocio);
  return useMutation({
    mutationFn: (idVacuna: number) => api.eliminarComprobante(idVacuna),
    onSuccess: recargar,
  });
}
