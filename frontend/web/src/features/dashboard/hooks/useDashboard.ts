import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { getDashboard, type ConsultaDashboard } from "@/api/dashboard";
import { hoyISO } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";
import { esPeriodo, PERIODO_POR_DEFECTO, rangoDe, type Periodo } from "../periodos";

export interface FiltrosDashboard {
  periodo: Periodo;
  desde: string;
  hasta: string;
  idSucursal: number | undefined;
}

/**
 * Filtros del dashboard en la URL (`periodo`, `desde` y `hasta` si es personalizado,
 * `sede`), así un enlace abre la misma vista. Sin parámetros, los últimos 30 días.
 */
export function useFiltrosDashboard(): [
  FiltrosDashboard,
  (cambios: { periodo?: Periodo; desde?: string; hasta?: string; idSucursal?: number | null }) => void,
] {
  const [params, setParams] = useSearchParams();
  const crudo = params.get("periodo");
  const periodo = esPeriodo(crudo) ? crudo : PERIODO_POR_DEFECTO;
  const sede = Number(params.get("sede"));
  const desdeUrl = params.get("desde");
  const hastaUrl = params.get("hasta");

  const filtros = useMemo(() => {
    const rango = rangoDe(periodo, hoyISO(), { desde: desdeUrl, hasta: hastaUrl });
    return { periodo, ...rango, idSucursal: Number.isInteger(sede) && sede > 0 ? sede : undefined };
  }, [periodo, desdeUrl, hastaUrl, sede]);

  const cambiar = useCallback(
    (cambios: { periodo?: Periodo; desde?: string; hasta?: string; idSucursal?: number | null }) => {
      setParams((actuales) => {
        const nuevos = new URLSearchParams(actuales);
        if (cambios.periodo) {
          if (cambios.periodo === PERIODO_POR_DEFECTO) nuevos.delete("periodo");
          else nuevos.set("periodo", cambios.periodo);
          if (cambios.periodo !== "personalizado") {
            nuevos.delete("desde");
            nuevos.delete("hasta");
          }
        }
        if (cambios.desde) nuevos.set("desde", cambios.desde);
        if (cambios.hasta) nuevos.set("hasta", cambios.hasta);
        if (cambios.idSucursal === null) nuevos.delete("sede");
        else if (cambios.idSucursal !== undefined) nuevos.set("sede", String(cambios.idSucursal));
        return nuevos;
      });
    },
    [setParams],
  );

  return [filtros, cambiar];
}

/** Requiere reportes.ver. Mientras carga otro rango se sigue viendo el anterior. */
export function useDashboard(idNegocio: number, consulta: ConsultaDashboard, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.datos(idNegocio, consulta),
    queryFn: () => getDashboard(idNegocio, consulta),
    enabled: habilitada,
    placeholderData: (anterior) => anterior,
  });
}
