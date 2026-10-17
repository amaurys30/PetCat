import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "@/api/clientes";
import { queryKeys } from "@/lib/queryKeys";

/** Los diálogos muestran sus errores (422 por campo, 409 en línea). */
const meta = { avisarError: false } as const;

/**
 * Búsqueda exacta por teléfono o correo. Es una mutación: se lanza al confirmar (la API
 * tiene un límite estricto de solicitudes) y no se guarda en caché.
 */
export function useBuscarCliente(idNegocio: number) {
  return useMutation({
    meta,
    mutationFn: (consulta: { email: string } | { telefono: string }) =>
      api.buscarClientes(idNegocio, consulta),
  });
}

/** Por nombre entre los clientes del negocio (clientes.ver). */
export function useBuscarClientePorNombre(idNegocio: number) {
  return useMutation({
    meta,
    mutationFn: async (q: string) => (await api.getClientes(idNegocio, { q, limit: 5 })).data,
  });
}

export function useClienteDetalle(idNegocio: number, idUsuario: number | null, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.clientes.detalle(idNegocio, idUsuario ?? 0),
    queryFn: () => api.getCliente(idNegocio, idUsuario!),
    enabled: idUsuario !== null && habilitada,
  });
}

function useRecargarClientes(idNegocio: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clientes.todos(idNegocio) });
}

export function useRegistrarCliente(idNegocio: number) {
  const recargar = useRecargarClientes(idNegocio);
  return useMutation({
    meta,
    mutationFn: (body: api.RegistrarClienteBody) => api.registrarCliente(idNegocio, body),
    onSuccess: recargar,
  });
}

export function useAgregarMascota(idNegocio: number) {
  const recargar = useRecargarClientes(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idUsuario, ...body }: api.MascotaNueva & { idUsuario: number }) =>
      api.agregarMascota(idNegocio, idUsuario, body),
    onSuccess: recargar,
  });
}

const POR_PAGINA = 20;

/** Siguiente página de una consulta paginada de la API, o undefined si no hay más. */
const siguiente = ({ meta }: { meta: { page: number; hasNext: boolean } }) =>
  meta.hasNext ? meta.page + 1 : undefined;

/** C1 · Clientes del negocio (clientes.ver), de 20 en 20, con búsqueda y orden. */
export function useListaClientes(idNegocio: number, params: { q: string; orden: api.OrdenClientes }) {
  return useInfiniteQuery({
    queryKey: queryKeys.clientes.lista(idNegocio, params),
    queryFn: ({ pageParam }) =>
      api.getClientes(idNegocio, {
        q: params.q || undefined,
        orden: params.orden,
        page: pageParam,
        limit: POR_PAGINA,
      }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    // Al escribir en la búsqueda, la lista anterior se queda hasta que llega la nueva.
    placeholderData: keepPreviousData,
  });
}

/** Todas las citas del cliente con el negocio ("Ver todas"). */
export function useCitasCliente(idNegocio: number, idUsuario: number, habilitada: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.clientes.citas(idNegocio, idUsuario),
    queryFn: ({ pageParam }) =>
      api.getCitasCliente(idNegocio, idUsuario, { page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: habilitada,
  });
}

/** Todas las notas del cliente ("Ver todas"); el detalle trae solo las 3 últimas. */
export function useNotasCliente(idNegocio: number, idUsuario: number, habilitada: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.clientes.notas(idNegocio, idUsuario),
    queryFn: ({ pageParam }) => api.getNotas(idNegocio, idUsuario, { page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: habilitada,
  });
}

/** Escribir, editar y borrar notas recargan el detalle (notas recientes y total) y la lista. */
export function useCrearNota(idNegocio: number, idUsuario: number) {
  const recargar = useRecargarClientes(idNegocio);
  return useMutation({
    mutationFn: (texto: string) => api.crearNota(idNegocio, idUsuario, texto),
    onSuccess: recargar,
  });
}

export function useEditarNota(idNegocio: number) {
  const recargar = useRecargarClientes(idNegocio);
  return useMutation({
    mutationFn: ({ idNota, texto }: { idNota: number; texto: string }) => api.editarNota(idNota, texto),
    onSuccess: recargar,
  });
}

export function useBorrarNota(idNegocio: number) {
  const recargar = useRecargarClientes(idNegocio);
  return useMutation({
    mutationFn: (idNota: number) => api.borrarNota(idNota),
    onSuccess: recargar,
  });
}

/** Poner, corregir o reenviar el correo de bienvenida. El diálogo muestra sus errores. */
export function useAsignarCorreo(idNegocio: number, idUsuario: number, { avisarError = false } = {}) {
  const recargar = useRecargarClientes(idNegocio);
  return useMutation({
    meta: { avisarError },
    mutationFn: (email: string) => api.asignarCorreo(idNegocio, idUsuario, email),
    onSuccess: recargar,
  });
}

/** Búsqueda del Topbar: hasta 5 clientes por nombre, correo, teléfono o mascota. */
export function useBusquedaClientes(idNegocio: number, q: string, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.clientes.busqueda(idNegocio, q),
    queryFn: async () => (await api.getClientes(idNegocio, { q, limit: 5 })).data,
    enabled: habilitada && q.length >= 2,
    placeholderData: keepPreviousData,
  });
}
