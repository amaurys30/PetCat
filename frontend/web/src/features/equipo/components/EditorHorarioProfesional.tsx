import { Copy, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RangoProfesional, SemanaProfesional } from "@/lib/disponibilidad";
import { HORAS, NOMBRES_DIA, ORDEN_DIAS, rangoSiguiente } from "@/lib/horarios";
import { cn } from "@/lib/utils";

interface Props {
  value: SemanaProfesional;
  onChange: (semana: SemanaProfesional) => void;
  sedes: { id_sucursal: number; nombre: string }[];
  /** Errores por rango con clave `${dia}-${indice}`. */
  errores?: Record<string, string>;
  disabled?: boolean;
  /**
   * Horario de la sede por día (índice = dia_semana). Con la semana vacía el profesional
   * sigue la sede: cada día muestra esto en lugar de "No trabaja".
   */
  referencia?: string[];
}

const LABORALES = [1, 2, 3, 4, 5];
const TODOS = [0, 1, 2, 3, 4, 5, 6];

/** Nombre corto de la sede para la ficha: "Sede Centro" -> "Centro". */
const nombreCorto = (nombre: string) => nombre.replace(/^sede\s+/i, "");

/**
 * Horario semanal de un profesional (D5): cada rango con su sede (o cualquiera). Con una
 * sola sede no se muestra la sede. Es controlado: la página guarda la semana completa.
 */
export function EditorHorarioProfesional({
  value,
  onChange,
  sedes,
  errores = {},
  disabled = false,
  referencia,
}: Props) {
  const variasSedes = sedes.length > 1;
  const sigueSede = Boolean(referencia) && value.every((rangos) => rangos.length === 0);
  const cambiarDia = (dia: number, rangos: RangoProfesional[]) =>
    onChange(value.map((r, d) => (d === dia ? rangos : r)));
  const copiar = (desde: number, dias: readonly number[]) =>
    onChange(value.map((r, d) => (dias.includes(d) ? value[desde]!.map((x) => ({ ...x })) : r)));
  const nombreSede = (id: number | null) =>
    id === null
      ? "Cualquier sede"
      : nombreCorto(sedes.find((s) => s.id_sucursal === id)?.nombre ?? `Sede ${id}`);

  return (
    <ul className="flex flex-col">
      {ORDEN_DIAS.map((dia) => {
        const rangos = value[dia]!;
        const nombre = NOMBRES_DIA[dia];
        const siguiente = rangoSiguiente(rangos.map((r) => ({ apertura: r.inicio, cierre: r.fin })));
        const erroresDia = rangos.map((_, i) => errores[`${dia}-${i}`]).filter(Boolean);
        return (
          <li key={dia} className="border-b border-track py-2.5 last:border-b-0">
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-body font-semibold text-ink">{nombre}</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {rangos.length === 0 && (
                  <span className="text-label text-muted">
                    {sigueSede ? referencia?.[dia] : "No trabaja"}
                  </span>
                )}
                {rangos.map((rango, i) => (
                  <FichaRango
                    key={i}
                    dia={nombre}
                    rango={rango}
                    sedes={sedes}
                    etiquetaSede={variasSedes ? nombreSede(rango.id_sucursal) : null}
                    error={errores[`${dia}-${i}`]}
                    disabled={disabled}
                    onChange={(nuevo) =>
                      cambiarDia(
                        dia,
                        rangos.map((r, j) => (j === i ? nuevo : r)),
                      )
                    }
                    onQuitar={() =>
                      cambiarDia(
                        dia,
                        rangos.filter((_, j) => j !== i),
                      )
                    }
                  />
                ))}
                {siguiente && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      cambiarDia(dia, [
                        ...rangos,
                        {
                          inicio: siguiente.apertura,
                          fin: siguiente.cierre,
                          id_sucursal: rangos.at(-1)?.id_sucursal ?? null,
                        },
                      ])
                    }
                    aria-label={`Agregar rango al ${nombre.toLowerCase()}`}
                    className="inline-flex h-7 items-center gap-1 rounded-control px-1.5 text-label font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"
                  >
                    <Plus className="size-3.5" aria-hidden /> rango
                  </button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={disabled}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Copiar el horario del ${nombre.toLowerCase()}`}
                  >
                    <Copy className="size-4 text-muted" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => copiar(dia, LABORALES)}>
                    Copiar a lunes–viernes
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => copiar(dia, TODOS)}>
                    Copiar a todos los días
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {erroresDia.length > 0 && (
              <p className="mt-1 pl-27 text-label text-danger">{erroresDia.join(" · ")}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FichaRango({
  dia,
  rango,
  sedes,
  etiquetaSede,
  error,
  disabled,
  onChange,
  onQuitar,
}: {
  dia: string;
  rango: RangoProfesional;
  sedes: { id_sucursal: number; nombre: string }[];
  etiquetaSede: string | null;
  error?: string;
  disabled: boolean;
  onChange: (r: RangoProfesional) => void;
  onQuitar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const texto = `${rango.inicio}–${rango.fin}`;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-control text-label font-semibold",
        error ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-dark",
      )}
    >
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          disabled={disabled}
          aria-label={`Editar rango ${texto}${etiquetaSede ? ` en ${etiquetaSede}` : ""} del ${dia.toLowerCase()}`}
          aria-invalid={error ? true : undefined}
          className="flex h-full items-center gap-1.5 rounded-l-control pr-1 pl-2.5 tabular-nums hover:underline"
        >
          {texto}
          {etiquetaSede && <span className="font-normal opacity-75">{etiquetaSede}</span>}
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <p className="mb-2 text-label font-semibold text-ink">{dia}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-label text-muted">
              Desde
              <NativeSelect
                value={rango.inicio}
                onChange={(e) => onChange({ ...rango, inicio: e.target.value })}
                className="h-9"
              >
                {HORAS.slice(0, -1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1 text-label text-muted">
              Hasta
              <NativeSelect
                value={rango.fin}
                onChange={(e) => onChange({ ...rango, fin: e.target.value })}
                className="h-9"
              >
                {HORAS.slice(1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </NativeSelect>
            </label>
            {sedes.length > 1 && (
              <label className="col-span-2 flex flex-col gap-1 text-label text-muted">
                Sede
                <NativeSelect
                  value={rango.id_sucursal ?? ""}
                  onChange={(e) =>
                    onChange({ ...rango, id_sucursal: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="h-9"
                >
                  <option value="">Cualquier sede</option>
                  {sedes.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.nombre}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
          </div>
          {error && <p className="mt-2 text-label text-danger">{error}</p>}
          <Button size="sm" className="mt-3 w-full" onClick={() => setAbierto(false)}>
            Listo
          </Button>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        disabled={disabled}
        onClick={onQuitar}
        aria-label={`Quitar rango ${texto} del ${dia.toLowerCase()}`}
        className="flex h-full items-center rounded-r-control pr-2 pl-1 opacity-70 hover:opacity-100"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
