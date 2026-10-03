import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useParams } from "react-router";
import { getSuscripcion } from "@/api/negocios";
import type { Modulo, NegocioMio } from "@/api/types";
import { puede } from "@/lib/permisos";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/stores/auth";

/** Negocio de la URL (/n/:idNegocio) si el usuario puede entrar a él. */
export function useNegocioDeRuta(): NegocioMio | null {
  const { idNegocio } = useParams();
  const negocios = useAuth((s) => s.usuario?.negocios);
  const id = Number(idNegocio);
  return negocios?.find((n) => n.id_negocio === id) ?? null;
}

/** Dentro de las rutas del panel, el negocio activo siempre existe (lo garantiza NegocioLayout). */
export function useNegocioActivo(): NegocioMio {
  const negocio = useNegocioDeRuta();
  if (!negocio) throw new Error("useNegocioActivo fuera de /n/:idNegocio");
  return negocio;
}

/** `puede(modulo, accion)` para el usuario y el negocio activo. */
export function usePuede() {
  const usuario = useAuth((s) => s.usuario);
  const negocio = useNegocioDeRuta();
  return useCallback(
    (modulo: Modulo, accion: string) => puede(usuario, negocio, modulo, accion),
    [usuario, negocio],
  );
}

export function useSuscripcion(idNegocio: number, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.negocios.suscripcion(idNegocio),
    queryFn: () => getSuscripcion(idNegocio),
    enabled: habilitada,
  });
}
