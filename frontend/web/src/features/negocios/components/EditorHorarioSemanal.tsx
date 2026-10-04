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
import {
  HORAS,
  NOMBRES_DIA,
  ORDEN_DIAS,
  PLANTILLAS,
  rangoSiguiente,
  semanasIguales,
  textoRango,
  type Rango,
  type Semana,
} from "@/lib/horarios";
import { cn } from "@/lib/utils";

interface Props {
  value: Semana;
  onChange: (semana: Semana) => void;
  /** Errores por rango con clave `${dia}-${indice}` (del cliente o del 422 de la API). */
  errores?: Record<string, string>;
  disabled?: boolean;
  /** Tarjeta angosta (asistente A6): "+" sin texto y nombres de día más cortos. */
  compacto?: boolean;
}

const LABORALES = [1, 2, 3, 4, 5];
const TODOS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Horario de la semana (A6c y E2): cada día con sus rangos como fichas, "+ rango",
 * "Cerrado" sin rangos, plantillas y copiar un día a otros. Es controlado: la página
 * decide cuándo guardar (un solo PUT con la semana completa).
 */
export function EditorHorarioSemanal({
  value,
  onChange,
  errores = {},
  disabled = false,
  compacto = false,
}: Props) {
  // Sin reordenar al editar: la ficha abierta sigue siendo la misma (se ordena al cargar desde la API).
  const cambiarDia = (dia: number, rangos: Rango[]) =>
    onChange(value.map((r, d) => (d === dia ? rangos : r)));

  const copiar = (desde: number, dias: readonly number[]) =>
    onChange(value.map((r, d) => (dias.includes(d) ? value[desde]!.map((x) => ({ ...x })) : r)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-label text-muted">Plantillas:</span>
        {PLANTILLAS.map((p) => {
          const activa = semanasIguales(value, p.semana());
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              aria-pressed={activa}
              onClick={() => onChange(p.semana())}
              className={cn(
                "h-7 rounded-control border px-2.5 text-label font-semibold transition-colors disabled:opacity-50",
                activa ? "border-primary bg-primary text-white" : "bg-white text-ink hover:bg-surface",
              )}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col">
        {ORDEN_DIAS.map((dia) => {
          const rangos = value[dia]!;
          const nombre = NOMBRES_DIA[dia];
          const siguiente = rangoSiguiente(rangos);
          const erroresDia = rangos.map((_, i) => errores[`${dia}-${i}`]).filter(Boolean);
          return (
            <li key={dia} className="border-b border-track py-2.5 last:border-b-0">
              <div className="flex items-center gap-3">
                <span className={cn("shrink-0 text-body font-semibold text-ink", compacto ? "w-20" : "w-24")}>
                  {nombre}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {rangos.length === 0 && (
                    <span className="rounded-full bg-track px-2 py-0.5 text-label text-muted">Cerrado</span>
                  )}
                  {rangos.map((rango, i) => (
                    <FichaRango
                      key={i}
                      dia={nombre}
                      rango={rango}
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
                      onClick={() => cambiarDia(dia, [...rangos, siguiente])}
                      aria-label={`Agregar rango al ${nombre.toLowerCase()}`}
                      className="inline-flex h-7 items-center gap-1 rounded-control px-1.5 text-label font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {!compacto && " rango"}
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
                <p className={cn("mt-1 text-label text-danger", compacto ? "pl-23" : "pl-27")}>
                  {erroresDia.join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FichaRango({
  dia,
  rango,
  error,
  disabled,
  onChange,
  onQuitar,
}: {
  dia: string;
  rango: Rango;
  error?: string;
  disabled: boolean;
  onChange: (r: Rango) => void;
  onQuitar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const texto = textoRango(rango);
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
          aria-label={`Editar rango ${texto} del ${dia.toLowerCase()}`}
          aria-invalid={error ? true : undefined}
          className="h-full rounded-l-control pr-1 pl-2.5 tabular-nums hover:underline"
        >
          {texto}
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="mb-2 text-label font-semibold text-ink">{dia}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-label text-muted">
              Abre
              <NativeSelect
                value={rango.apertura}
                onChange={(e) => onChange({ ...rango, apertura: e.target.value })}
                className="h-9"
              >
                {HORAS.slice(0, -1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1 text-label text-muted">
              Cierra
              <NativeSelect
                value={rango.cierre}
                onChange={(e) => onChange({ ...rango, cierre: e.target.value })}
                className="h-9"
              >
                {HORAS.slice(1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </NativeSelect>
            </label>
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
