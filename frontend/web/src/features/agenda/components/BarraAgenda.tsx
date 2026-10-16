import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { EstadoCita } from "@/api/citas";
import type { Profesional } from "@/api/empleados";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { inputClases } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ESTADOS_CITA, type CambiosUrl, type FiltrosUrl, type Vista } from "../hooks/useAgenda";
import { nombreCompleto } from "../textos";

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: "dia", texto: "Día" },
  { valor: "semana", texto: "Semana" },
  { valor: "lista", texto: "Lista" },
];

const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  pendiente: "Pendientes",
  confirmada: "Confirmadas",
  en_curso: "En curso",
  completada: "Completadas",
  cancelada: "Canceladas",
  no_asistio: "No asistió",
  reprogramada: "Reprogramadas",
};

/** Navegación (‹ Hoy ›), vista (Día · Semana · Lista) y filtros de la agenda. */
export function BarraAgenda({
  filtros,
  cambiar,
  titulo,
  profesionales,
  sedes,
  conPerfilPropio,
  puedeCrear,
  onNuevaCita,
  onAnterior,
  onSiguiente,
  onHoy,
}: {
  filtros: FiltrosUrl;
  cambiar: (cambios: CambiosUrl) => void;
  titulo: string;
  profesionales: Profesional[];
  sedes: { id_sucursal: number; nombre: string }[];
  /** El usuario es profesional de este negocio ("Solo mis citas"). */
  conPerfilPropio: boolean;
  puedeCrear: boolean;
  onNuevaCita: () => void;
  onAnterior: () => void;
  onSiguiente: () => void;
  onHoy: () => void;
}) {
  const unidad = filtros.vista === "dia" ? "día" : "semana";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        aria-label={`${unidad === "día" ? "Día" : "Semana"} anterior`}
        onClick={onAnterior}
      >
        <ChevronLeft />
      </Button>
      <Button variant="secondary" onClick={onHoy}>
        Hoy
      </Button>
      <Button
        variant="secondary"
        size="icon"
        aria-label={`${unidad === "día" ? "Día" : "Semana"} siguiente`}
        onClick={onSiguiente}
      >
        <ChevronRight />
      </Button>
      <h2 className="mx-2 text-title font-bold text-ink" aria-live="polite">
        {titulo}
      </h2>

      <div role="radiogroup" aria-label="Vista" className="flex rounded-control bg-track p-0.5">
        {VISTAS.map((v) => (
          <button
            key={v.valor}
            type="button"
            role="radio"
            aria-checked={filtros.vista === v.valor}
            onClick={() => cambiar({ vista: v.valor, fuera: undefined })}
            className={cn(
              "h-8 rounded-[6px] px-3 text-body font-medium text-muted",
              filtros.vista === v.valor && "bg-white text-ink shadow-card",
            )}
          >
            {v.texto}
          </button>
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {sedes.length > 1 && (
          <Select
            value={filtros.idSucursal?.toString() ?? "todas"}
            onValueChange={(v) => cambiar({ idSucursal: v === "todas" ? undefined : Number(v) })}
          >
            <SelectTrigger className="w-44" aria-label="Sede">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sedes</SelectItem>
              {sedes.map((s) => (
                <SelectItem key={s.id_sucursal} value={String(s.id_sucursal)}>
                  {s.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filtros.idEmpleado?.toString() ?? "todos"}
          onValueChange={(v) => cambiar({ idEmpleado: v === "todos" ? undefined : Number(v) })}
          disabled={filtros.mias}
        >
          <SelectTrigger className="w-52" aria-label="Profesional">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los profesionales</SelectItem>
            {profesionales.map((p) => (
              <SelectItem key={p.id_empleado} value={String(p.id_empleado)}>
                {nombreCompleto(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FiltroEstados
          estados={filtros.estados}
          onChange={(estados) => cambiar({ estados })}
          deshabilitado={filtros.vista === "lista" && filtros.fuera}
        />

        {conPerfilPropio && (
          <label className="flex items-center gap-2 px-1 text-body text-muted">
            <Switch
              checked={filtros.mias}
              onCheckedChange={(mias) => cambiar({ mias, idEmpleado: undefined })}
            />
            Solo mis citas
          </label>
        )}

        {puedeCrear && (
          <Button onClick={onNuevaCita}>
            <Plus /> Nueva cita
          </Button>
        )}
      </div>
    </div>
  );
}

function FiltroEstados({
  estados,
  onChange,
  deshabilitado,
}: {
  estados: EstadoCita[];
  onChange: (estados: EstadoCita[]) => void;
  deshabilitado: boolean;
}) {
  const texto =
    estados.length === 0
      ? "Todos los estados"
      : estados.length === 1
        ? NOMBRE_ESTADO[estados[0]!]
        : `${estados.length} estados`;
  const alternar = (estado: EstadoCita, marcado: boolean) =>
    onChange(ESTADOS_CITA.filter((e) => (e === estado ? marcado : estados.includes(e))));

  return (
    <Popover>
      <PopoverTrigger
        disabled={deshabilitado}
        aria-label={`Estados: ${texto}`}
        className={cn(
          inputClases,
          "flex w-44 items-center justify-between gap-2 text-left disabled:opacity-50",
        )}
      >
        <span className="truncate">{texto}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <fieldset>
          <legend className="mb-2 text-label font-semibold text-muted">Mostrar citas</legend>
          <div className="flex flex-col gap-2">
            {ESTADOS_CITA.map((e) => (
              <label key={e} className="flex items-center gap-2 text-body text-ink">
                <Checkbox checked={estados.includes(e)} onCheckedChange={(v) => alternar(e, v === true)} />
                {NOMBRE_ESTADO[e]}
              </label>
            ))}
          </div>
          {estados.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-3 text-label font-semibold text-primary hover:underline"
            >
              Ver todos los estados
            </button>
          )}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
