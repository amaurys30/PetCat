import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { CitaPanel } from "@/api/citas";
import { acomodar, aHora, aMinutos, MINUTOS_FILA, type Tramo, type TramoCerrado } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { CitaBloque } from "./CitaBloque";

/** Alto en píxeles de una fila de 15 minutos (una hora = 64 px). */
const ALTO_FILA = 16;
const px = (minutos: number) => (minutos / MINUTOS_FILA) * ALTO_FILA;

export interface ColumnaCalendario {
  clave: string;
  /** Nombre accesible de la columna ("Lunes 5 de octubre", "Paula Rojas"). */
  nombre: string;
  encabezado: ReactNode;
  /** Resalta la columna (hoy en la vista Semana). */
  resaltada?: boolean;
  /** Tramos en que no se atiende (sombreados, con su etiqueta). */
  cerrados: TramoCerrado[];
  /** Bloqueos y vacaciones del profesional (vista Día), con otro tono. */
  bloqueos?: TramoCerrado[];
}

/**
 * Calendario propio de la agenda (B3 y B9): una columna por día o por profesional,
 * cuadrícula de 15 minutos, tramos cerrados sombreados, línea de la hora actual y las
 * citas que se cruzan lado a lado. Sin arrastrar y soltar: mover una cita es reprogramarla.
 */
export function Calendario({
  columnas,
  citas,
  ventana,
  ahora,
  vista,
  idSeleccionada,
  onAbrir,
}: {
  columnas: ColumnaCalendario[];
  citas: { cita: CitaPanel; columna: string }[];
  ventana: Tramo;
  /** Minuto actual y en qué columnas se dibuja la línea (null: no está en el rango). */
  ahora: { minuto: number; columnas: string[] } | null;
  vista: "semana" | "dia";
  idSeleccionada?: number;
  onAbrir: (cita: CitaPanel) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const alto = px(ventana.fin - ventana.inicio);
  const horas = useMemo(() => {
    const lista: number[] = [];
    for (let m = ventana.inicio; m < ventana.fin; m += 60) lista.push(m);
    return lista;
  }, [ventana]);

  const porColumna = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof acomodar<CitaPanel>>>();
    for (const col of columnas) {
      const deLaColumna = citas.filter((c) => c.columna === col.clave).map((c) => c.cita);
      mapa.set(
        col.clave,
        acomodar(deLaColumna, (c) => ({ inicio: aMinutos(c.hora_inicio), fin: aMinutos(c.hora_fin) })),
      );
    }
    return mapa;
  }, [columnas, citas]);

  const lineaVisible = ahora !== null && ahora.minuto >= ventana.inicio && ahora.minuto <= ventana.fin;

  // Al abrir, si la hora actual quedaría por debajo de lo visible, se baja hasta ella (con
  // una hora de contexto arriba).
  useEffect(() => {
    const contenedor = scroll.current;
    if (!lineaVisible || !contenedor) return;
    const posicion = px(ahora.minuto - ventana.inicio);
    if (posicion > contenedor.clientHeight - 120) contenedor.scrollTop = Math.max(0, posicion - px(60));
    // Solo al montar o al cambiar de rango; no en cada minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventana.inicio, ventana.fin, columnas.length]);

  const plantilla = { gridTemplateColumns: `56px repeat(${columnas.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-card border bg-white">
      <div
        ref={scroll}
        className="max-h-[calc(100vh-232px)] min-h-80 overflow-y-auto"
        data-testid="calendario"
      >
        <div className="sticky top-0 z-30 grid border-b bg-white" style={plantilla}>
          <div />
          {columnas.map((col) => (
            <div
              key={col.clave}
              className={cn(
                "flex h-11 min-w-0 items-center border-l px-3 text-body font-semibold text-ink",
                col.resaltada && "bg-selected text-primary-dark",
              )}
            >
              {col.encabezado}
            </div>
          ))}
        </div>

        <div className="grid" style={plantilla}>
          <div className="relative" style={{ height: alto }} aria-hidden>
            {horas.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-label text-subtle tabular-nums first:translate-y-0"
                style={{ top: px(m - ventana.inicio) + (m === ventana.inicio ? 4 : 0) }}
              >
                {aHora(m)}
              </span>
            ))}
          </div>

          {columnas.map((col) => (
            <div
              key={col.clave}
              role="group"
              aria-label={col.nombre}
              className={cn("relative border-l", col.resaltada && "bg-selected/60")}
              style={{
                height: alto,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${px(60)}px)`,
              }}
            >
              {col.cerrados.map((t) => (
                <Sombreado key={`c${t.inicio}`} tramo={t} ventana={ventana} tono="cerrado" />
              ))}
              {col.bloqueos?.map((t) => (
                <Sombreado key={`b${t.inicio}`} tramo={t} ventana={ventana} tono="bloqueo" />
              ))}

              {porColumna.get(col.clave)?.map(({ item: cita, columna, columnas: total }) => {
                const inicio = Math.max(aMinutos(cita.hora_inicio), ventana.inicio);
                const fin = Math.min(Math.max(aMinutos(cita.hora_fin), inicio + MINUTOS_FILA), ventana.fin);
                return (
                  <CitaBloque
                    key={cita.id_cita}
                    cita={cita}
                    vista={vista}
                    seleccionada={cita.id_cita === idSeleccionada}
                    onAbrir={onAbrir}
                    style={{
                      top: px(inicio - ventana.inicio) + 1,
                      height: Math.max(px(fin - inicio) - 2, ALTO_FILA),
                      left: `calc(${(columna / total) * 100}% + 3px)`,
                      width: `calc(${100 / total}% - 6px)`,
                    }}
                  />
                );
              })}

              {lineaVisible && ahora.columnas.includes(col.clave) && (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-20 h-0.5 bg-danger"
                  style={{ top: px(ahora.minuto - ventana.inicio) }}
                  data-testid="hora-actual"
                >
                  <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-danger" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sombreado({
  tramo,
  ventana,
  tono,
}: {
  tramo: TramoCerrado;
  ventana: Tramo;
  tono: "cerrado" | "bloqueo";
}) {
  const inicio = Math.max(tramo.inicio, ventana.inicio);
  const fin = Math.min(tramo.fin, ventana.fin);
  if (fin <= inicio) return null;
  return (
    <div
      className={cn(
        "absolute right-0 left-0 overflow-hidden px-2 pt-1 text-[10px] leading-3",
        tono === "cerrado" ? "bg-track/80 text-muted" : "bg-danger-soft/70 text-danger",
      )}
      style={{ top: px(inicio - ventana.inicio), height: px(fin - inicio) }}
    >
      {tramo.etiqueta}
    </div>
  );
}
