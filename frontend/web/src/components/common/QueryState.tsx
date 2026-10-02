import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import {
  Cargando,
  EstadoPantalla,
  LimitePlan,
  NoEncontrado,
  SinConexion,
  SinPermiso,
} from "./EstadoPantalla";
import { PlanLimitAcciones } from "./PlanLimitDialog";

/**
 * Pinta el estado de una consulta: carga (esqueleto), error según el código (S1)
 * o el contenido con los datos. `vacio` se muestra si `esVacio(datos)`.
 */
export function QueryState<T>({
  query,
  children,
  cargando,
  vacio,
  esVacio,
}: {
  query: UseQueryResult<T, ApiError>;
  children: (datos: T) => ReactNode;
  cargando?: ReactNode;
  vacio?: ReactNode;
  esVacio?: (datos: T) => boolean;
}) {
  if (query.isPending) return <>{cargando ?? <Cargando />}</>;
  if (query.isError) return <ErrorConsulta error={query.error} reintentar={() => void query.refetch()} />;
  if (vacio && esVacio?.(query.data)) return <>{vacio}</>;
  return <>{children(query.data)}</>;
}

export function ErrorConsulta({ error, reintentar }: { error: ApiError; reintentar: () => void }) {
  const botonReintentar = (
    <Button variant="secondary" onClick={reintentar}>
      Reintentar
    </Button>
  );
  if (error.sinConexion) return <SinConexion acciones={botonReintentar} />;
  if (error.limitePlan) return <LimitePlan descripcion={error.message} acciones={<PlanLimitAcciones />} />;
  if (error.status === 403) return <SinPermiso descripcion={error.message} />;
  if (error.status === 404) return <NoEncontrado descripcion={error.message} />;
  return (
    <EstadoPantalla
      icono={AlertTriangle}
      tono="danger"
      titulo="No se pudo cargar"
      descripcion={error.message}
      acciones={botonReintentar}
    />
  );
}
