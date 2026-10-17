import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
