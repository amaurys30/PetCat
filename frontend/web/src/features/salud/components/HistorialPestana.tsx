import { Stethoscope } from "lucide-react";
import { useState } from "react";
import { TIPOS_HISTORIAL, type FiltrosHistorial, type TipoHistorial } from "@/api/salud";
import { Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { useUi } from "@/stores/ui";
import { sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { useHistorial } from "../hooks/useSalud";
import { TIPO_HISTORIAL } from "../textos";
import { RegistroHistorialCard } from "./RegistroHistorialCard";

type Periodo = "todo" | "anio";
const TODOS = "todos";

/**
 * Historial médico de la mascota (historial_medico.ver), con filtros de tipo y período.
 * Sin `compartir_historial` la API devuelve solo los registros de este negocio y el aviso lo
 * explica.
 */
export function HistorialPestana({ idMascota, comparte }: { idMascota: number; comparte: boolean }) {
  const negocio = useNegocioActivo();
  const puedeEditar = usePuede()("historial_medico", "editar");
  const abrirRegistro = useUi((s) => s.abrirRegistroMedico);
  const [tipo, setTipo] = useState<TipoHistorial | typeof TODOS>(TODOS);
  const [periodo, setPeriodo] = useState<Periodo>("todo");
  const filtros: FiltrosHistorial = {
    tipo: tipo === TODOS ? undefined : tipo,
    desde: periodo === "anio" ? sumarDias(hoyISO(), -365) : undefined,
  };
  const historial = useHistorial(negocio.id_negocio, idMascota, filtros, true);
  const registros = historial.data?.pages.flatMap((p) => p.data) ?? [];
  const filtrado = tipo !== TODOS || periodo !== "todo";

  const obtenerArchivo = async (idArchivo: number) => {
    const r = await historial.refetch();
    return r.data?.pages
      .flatMap((p) => p.data.flatMap((x) => x.archivos))
      .find((a) => a.id_archivo === idArchivo);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoHistorial | typeof TODOS)}>
          <SelectTrigger aria-label="Tipo de registro" className="h-9 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los tipos</SelectItem>
            {TIPOS_HISTORIAL.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_HISTORIAL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger aria-label="Período" className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">Todo el historial</SelectItem>
            <SelectItem value="anio">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!comparte && (
        <Alert tono="info">
          El dueño no comparte el historial de otros negocios: ves solo los registros de tu negocio. Las
          vacunas, las alergias y las condiciones médicas se ven siempre.
        </Alert>
      )}
      {historial.isPending ? (
        <div className="flex flex-col gap-3" aria-label="Cargando historial">
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
        </div>
      ) : historial.isError ? (
        <ErrorConsulta error={historial.error} reintentar={() => void historial.refetch()} />
      ) : registros.length === 0 ? (
        <Vacio
          icono={Stethoscope}
          titulo={filtrado ? "Ningún registro con esos filtros" : "Aún no hay registros médicos"}
          descripcion={
            filtrado
              ? "Prueba con otro tipo o con todo el historial."
              : "Los registros de las consultas aparecerán aquí."
          }
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Historial médico">
          {registros.map((r) => (
            <li key={r.id_historial}>
              <RegistroHistorialCard
                registro={r}
                obtenerArchivo={obtenerArchivo}
                onEditar={
                  r.es_propio && puedeEditar ? () => abrirRegistro({ idMascota, registro: r }) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
      {historial.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void historial.fetchNextPage()}
          disabled={historial.isFetchingNextPage}
        >
          {historial.isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </Button>
      )}
    </div>
  );
}
