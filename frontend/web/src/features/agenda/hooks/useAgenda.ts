import { useQueries, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { getAgenda, getAtencion, type EstadoCita, type FiltrosAgenda } from "@/api/citas";
import { getDisponibilidad, getDisponibilidadEfectiva } from "@/api/disponibilidad";
import { getProfesionales } from "@/api/empleados";
import { hoyISO } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";

export type Vista = "semana" | "dia" | "lista";

export const ESTADOS_CITA: EstadoCita[] = [
  "pendiente",
  "confirmada",
  "en_curso",
  "completada",
  "cancelada",
  "no_asistio",
  "reprogramada",
];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const entero = (valor: string | null) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export interface FiltrosUrl {
  vista: Vista;
  fecha: string;
  idEmpleado?: number;
  idSucursal?: number;
  estados: EstadoCita[];
  mias: boolean;
  /** Solo en la Lista: las citas fuera de disponibilidad (de la atención, sin rango). */
  fuera: boolean;
  idCita?: number;
}

export type CambiosUrl = Partial<{ [K in keyof FiltrosUrl]: FiltrosUrl[K] | undefined }>;

/**
 * Estado de la agenda en la URL (`?vista=dia&fecha=2026-10-08&profesional=3&estados=pendiente`),
 * para poder compartir el enlace y volver atrás. Valores inválidos se ignoran.
 */
export function useFiltrosUrl(): [FiltrosUrl, (cambios: CambiosUrl) => void] {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo<FiltrosUrl>(() => {
    const vista = params.get("vista");
    const fecha = params.get("fecha") ?? "";
    return {
      vista: vista === "dia" || vista === "lista" ? vista : "semana",
      fecha: FECHA.test(fecha) ? fecha : hoyISO(),
      idEmpleado: entero(params.get("profesional")),
      idSucursal: entero(params.get("sede")),
      estados: (params.get("estados") ?? "")
        .split(",")
        .filter((e): e is EstadoCita => (ESTADOS_CITA as string[]).includes(e)),
      mias: params.get("mias") === "1",
      fuera: params.get("fuera") === "1",
      idCita: entero(params.get("cita")),
    };
  }, [params]);

  const cambiar = useCallback(
    (cambios: CambiosUrl) =>
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales);
          const poner = (clave: string, valor: string | undefined) =>
            valor ? nuevos.set(clave, valor) : nuevos.delete(clave);
          if ("vista" in cambios) poner("vista", cambios.vista === "semana" ? undefined : cambios.vista);
          if ("fecha" in cambios) poner("fecha", cambios.fecha === hoyISO() ? undefined : cambios.fecha);
          if ("idEmpleado" in cambios) poner("profesional", cambios.idEmpleado?.toString());
          if ("idSucursal" in cambios) poner("sede", cambios.idSucursal?.toString());
          if ("estados" in cambios) poner("estados", cambios.estados?.join(","));
          if ("mias" in cambios) poner("mias", cambios.mias ? "1" : undefined);
          if ("fuera" in cambios) poner("fuera", cambios.fuera ? "1" : undefined);
          if ("idCita" in cambios) poner("cita", cambios.idCita?.toString());
          return nuevos;
        },
        // Abrir o cerrar una cita no llena el historial; cambiar de semana o de vista sí.
        { replace: Object.keys(cambios).every((k) => k === "idCita") },
      ),
    [setParams],
  );

  return [filtros, cambiar];
}

export function useAgenda(
  idNegocio: number,
  consulta: FiltrosAgenda & { desde: string; hasta: string; estados: EstadoCita[] },
  habilitada: boolean,
) {
  return useQuery({
    queryKey: queryKeys.citas.agenda(idNegocio, consulta),
    queryFn: () => getAgenda(idNegocio, consulta),
    enabled: habilitada,
    placeholderData: (anterior) => anterior,
  });
}

export function useAtencion(idNegocio: number, filtros: FiltrosAgenda, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.citas.atencion(idNegocio, filtros),
    queryFn: () => getAtencion(idNegocio, filtros),
    enabled: habilitada,
  });
}

export function useProfesionales(idNegocio: number, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.empleados.profesionales(idNegocio),
    queryFn: () => getProfesionales(idNegocio),
    enabled: habilitada,
  });
}

/**
 * Disponibilidad de cada profesional en una fecha (vista Día): sus rangos efectivos y las
 * excepciones que cubren ese día. Dos consultas por profesional (ver Pendientes de API).
 */
export function useDisponibilidadDelDia(idsEmpleado: number[], fecha: string) {
  const efectivas = useQueries({
    queries: idsEmpleado.map((id) => ({
      queryKey: queryKeys.disponibilidad.efectiva(id, fecha),
      queryFn: () => getDisponibilidadEfectiva(id, fecha),
    })),
  });
  const excepciones = useQueries({
    queries: idsEmpleado.map((id) => ({
      queryKey: queryKeys.disponibilidad.delDia(id, fecha),
      queryFn: () => getDisponibilidad(id, { desde: fecha, hasta: fecha }),
    })),
  });
  return idsEmpleado.map((id, i) => ({
    idEmpleado: id,
    efectiva: efectivas[i]?.data,
    excepciones: excepciones[i]?.data?.excepciones,
    cargando: Boolean(efectivas[i]?.isPending || excepciones[i]?.isPending),
  }));
}

/** La hora actual, que se renueva cada minuto (línea de la hora y plazos para confirmar). */
export function useAhora(intervaloMs = 60_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}
