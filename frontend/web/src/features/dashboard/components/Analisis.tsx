import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { estaBloqueada, type Avanzadas, type Dashboard, type SeccionBloqueada } from "@/api/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BotonesPlan } from "@/features/suscripcion/components/PruebaPro";
import { cn } from "@/lib/utils";
import {
  AGRUPACION_TEXTO,
  dineroCorto,
  etiquetaPunto,
  franjaHoraria,
  plural,
  porcentaje,
  tasaInasistencia,
  tituloPunto,
  variacionPct,
} from "../textos";

type Libre<T> = Exclude<T, SeccionBloqueada>;
type Tendencia = Libre<Avanzadas["tendencia"]>;
type Comparacion = Libre<Avanzadas["comparacion"]>;
type FilaEmpleado = Libre<Avanzadas["por_empleado"]>[number];
type FilaSede = Libre<Avanzadas["por_sucursal"]>[number];

function Tarjeta({
  titulo,
  etiqueta,
  subtitulo,
  children,
  className,
}: {
  titulo: string;
  etiqueta?: ReactNode;
  /** Debajo del título (la variación de la tendencia). */
  subtitulo?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col p-5", className)}>
      <h2 className="flex items-center gap-2 text-card font-semibold text-ink">
        {titulo}
        {etiqueta}
      </h2>
      <div className="mb-3">{subtitulo}</div>
      {children}
    </Card>
  );
}

/** Barra horizontal de una lista (servicios, horas pico): el largo es el valor sobre el mayor. */
function Medidor({ valor, maximo, etiqueta }: { valor: number; maximo: number; etiqueta: string }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden title={etiqueta}>
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${maximo > 0 ? (valor / maximo) * 100 : 0}%` }}
      />
    </div>
  );
}

/** Sección avanzada en un plan sin estadísticas avanzadas: invitación a Pro, sin datos. */
export function SeccionBloqueadaCard({
  titulo,
  descripcion,
  seccion,
}: {
  titulo: string;
  descripcion: string;
  seccion: SeccionBloqueada;
}) {
  const plan = seccion.plan_requerido?.nombre ?? "Pro";
  return (
    <Tarjeta titulo={titulo} etiqueta={<Badge tono="info">{plan}</Badge>}>
      <div className="flex flex-1 flex-col items-center justify-center rounded-card bg-surface px-4 py-6 text-center">
        <Lock className="size-5 text-muted" aria-hidden />
        <p className="mt-2 text-body font-semibold text-ink">Disponible en el plan {plan}</p>
        <p className="mt-1 text-label text-muted">{descripcion}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <BotonesPlan />
        </div>
      </div>
    </Tarjeta>
  );
}

function EtiquetaVariacion({ valor }: { valor: number | null }) {
  const v = variacionPct(valor);
  if (!v || v.sentido === "igual") return null;
  const Flecha = v.sentido === "sube" ? ArrowUp : ArrowDown;
  return (
    <Badge tono={v.bueno ? "primary" : "danger"}>
      <Flecha className="size-3" aria-hidden />
      {v.texto}
    </Badge>
  );
}

/** Citas completadas por día, semana o mes, con la variación frente al periodo anterior. */
export function TendenciaCard({
  tendencia,
  comparacion,
}: {
  tendencia: Tendencia;
  comparacion: Comparacion | null;
}) {
  const { agrupacion, puntos } = tendencia;
  const datos = puntos.map((p) => ({ ...p, etiqueta: etiquetaPunto(p.inicio, agrupacion) }));
  const vacio = puntos.every((p) => p.completadas === 0);
  return (
    <Tarjeta
      titulo={`Completadas por ${AGRUPACION_TEXTO[agrupacion]}`}
      subtitulo={comparacion && <EtiquetaVariacion valor={comparacion.variacion_pct.completadas} />}
    >
      {vacio ? (
        <p className="py-8 text-center text-body text-muted">Sin citas completadas en el periodo.</p>
      ) : (
        <>
          <div className="h-44 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datos}
                margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                barCategoryGap={2}
                // Va dentro de aria-hidden (los datos están en la tabla sr-only): sin foco en el gráfico.
                accessibilityLayer={false}
              >
                <XAxis
                  dataKey="etiqueta"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                  height={20}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-track)" }}
                  separator=": "
                  labelFormatter={(_, carga) => {
                    const punto = carga?.[0]?.payload as (typeof datos)[number] | undefined;
                    return punto ? tituloPunto(punto.inicio, agrupacion) : "";
                  }}
                  formatter={(valor) => [String(valor), "Completadas"]}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }}
                />
                <Bar
                  dataKey="completadas"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Citas completadas por {AGRUPACION_TEXTO[agrupacion]}</caption>
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Completadas</th>
                <th>Citas</th>
                <th>Ingresos registrados</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((p) => (
                <tr key={p.inicio}>
                  <td>{tituloPunto(p.inicio, agrupacion)}</td>
                  <td>{p.completadas}</td>
                  <td>{p.citas}</td>
                  <td>{dineroCorto(p.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Tarjeta>
  );
}

/** Básico (todos los planes): los cinco servicios con más citas completadas y sus ingresos. */
export function ServiciosCard({ servicios }: { servicios: Dashboard["servicios_mas_pedidos"] }) {
  const maximo = Math.max(0, ...servicios.map((s) => s.completadas));
  return (
    <Tarjeta titulo="Servicios más pedidos">
      {servicios.length === 0 ? (
        <p className="py-8 text-center text-body text-muted">Sin citas completadas en el periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {servicios.map((s) => {
            const detalle = `${s.completadas} · ${dineroCorto(s.ingresos)}`;
            return (
              <li
                key={s.id_servicio}
                className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-body"
              >
                <span className="truncate text-ink">{s.nombre}</span>
                <Medidor valor={s.completadas} maximo={maximo} etiqueta={detalle} />
                <span className="text-label text-muted tabular-nums">{detalle}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

function FilaDesempeno({ nombre, fila }: { nombre: string; fila: FilaEmpleado | FilaSede }) {
  const tasa = tasaInasistencia(fila);
  return (
    <li className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="truncate text-body font-semibold text-ink">{nombre}</span>
      <span className="shrink-0 text-label text-muted tabular-nums">
        {plural(fila.citas, "cita", "citas")} · {dineroCorto(fila.ingresos)}
        {tasa !== null && ` · ${porcentaje(tasa)} inasist.`}
      </span>
    </li>
  );
}

export function PorEmpleadoCard({ filas }: { filas: FilaEmpleado[] }) {
  return (
    <Tarjeta titulo="Por profesional">
      {filas.length === 0 ? (
        <p className="py-8 text-center text-body text-muted">Sin citas en el periodo.</p>
      ) : (
        <ul>
          {filas.map((f) => (
            <FilaDesempeno
              key={f.empleado?.id_empleado ?? "sin"}
              nombre={f.empleado ? `${f.empleado.nombre} ${f.empleado.apellido}` : "Sin profesional"}
              fila={f}
            />
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export function PorSedeCard({ filas }: { filas: FilaSede[] }) {
  return (
    <Tarjeta titulo="Por sede">
      {filas.length === 0 ? (
        <p className="py-8 text-center text-body text-muted">Sin citas en el periodo.</p>
      ) : (
        <ul>
          {filas.map((f) => (
            <FilaDesempeno
              key={f.sucursal?.id_sucursal ?? "sin"}
              nombre={f.sucursal?.nombre ?? "Sin sede"}
              fila={f}
            />
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

const HORAS_PICO = 5;

export function HorasPicoCard({ horas }: { horas: Libre<Avanzadas["horas_pico"]> }) {
  const top = horas.slice(0, HORAS_PICO);
  const maximo = Math.max(0, ...top.map((h) => h.citas));
  return (
    <Tarjeta titulo="Horas pico">
      {top.length === 0 ? (
        <p className="py-8 text-center text-body text-muted">Sin citas en el periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {top.map((h) => {
            const citas = plural(h.citas, "cita", "citas");
            return (
              <li
                key={`${h.dia_semana}-${h.hora}`}
                className="grid grid-cols-[10.5rem_1fr_auto] items-center gap-3 text-body"
              >
                <span className="text-ink">{franjaHoraria(h)}</span>
                <Medidor valor={h.citas} maximo={maximo} etiqueta={citas} />
                <span className="text-label text-muted tabular-nums">{citas}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

export function RecurrenciaCard({
  recurrencia,
  cancelaciones,
}: {
  recurrencia: Libre<Avanzadas["recurrencia"]>;
  cancelaciones: Libre<Avanzadas["cancelaciones"]>;
}) {
  return (
    <Tarjeta titulo="Clientes que regresan y cancelaciones">
      <p className="text-title font-bold text-ink">{porcentaje(recurrencia.porcentaje)}</p>
      <p className="text-label text-muted">
        {recurrencia.recurrentes} de {plural(recurrencia.clientes, "cliente atendido", "clientes atendidos")}{" "}
        {recurrencia.recurrentes === 1 ? "volvió" : "volvieron"} dos veces o más
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-body">
        <dt className="text-muted">Canceladas</dt>
        <dd className="text-right font-semibold text-ink tabular-nums">{cancelaciones.total}</dd>
        <dt className="text-muted">Por el cliente</dt>
        <dd className="text-right text-ink tabular-nums">
          {cancelaciones.por_dueno}
          {cancelaciones.tardias > 0 && (
            <span className="text-muted"> ({cancelaciones.tardias} tardías)</span>
          )}
        </dd>
        <dt className="text-muted">Por el negocio</dt>
        <dd className="text-right text-ink tabular-nums">{cancelaciones.por_negocio}</dd>
        <dt className="text-muted">Sin confirmar a tiempo</dt>
        <dd className="text-right text-ink tabular-nums">{cancelaciones.por_sistema}</dd>
      </dl>
    </Tarjeta>
  );
}

/**
 * Análisis del periodo. Con estadísticas avanzadas: tendencia, servicios y profesionales;
 * sedes, horas pico y recurrencia. Sin ellas, "Servicios más pedidos" (básico) y las
 * secciones avanzadas como invitaciones a Pro (B2).
 */
export function Analisis({ datos }: { datos: Dashboard }) {
  const a = datos.avanzadas;
  if (
    estaBloqueada(a.tendencia) ||
    estaBloqueada(a.comparacion) ||
    estaBloqueada(a.por_empleado) ||
    estaBloqueada(a.por_sucursal) ||
    estaBloqueada(a.horas_pico) ||
    estaBloqueada(a.recurrencia) ||
    estaBloqueada(a.cancelaciones)
  ) {
    const seccion = [a.tendencia, a.por_empleado, a.horas_pico].find(estaBloqueada) as SeccionBloqueada;
    return (
      <section aria-label="Análisis del periodo" className="grid grid-cols-2 gap-5">
        <ServiciosCard servicios={datos.servicios_mas_pedidos} />
        <SeccionBloqueadaCard
          titulo="Tendencia y comparación"
          descripcion="Compara con el periodo anterior y consulta hasta 12 meses de historia."
          seccion={seccion}
        />
        <SeccionBloqueadaCard
          titulo="Rendimiento por profesional y sede"
          descripcion="Citas, ingresos e inasistencias de cada profesional y sede."
          seccion={seccion}
        />
        <SeccionBloqueadaCard
          titulo="Horas pico y recurrencia"
          descripcion="Descubre tus horas más ocupadas, cuántos clientes regresan y quién cancela."
          seccion={seccion}
        />
      </section>
    );
  }
  return (
    <section aria-label="Análisis del periodo" className="grid grid-cols-3 gap-5">
      <TendenciaCard tendencia={a.tendencia} comparacion={a.comparacion} />
      <ServiciosCard servicios={datos.servicios_mas_pedidos} />
      <PorEmpleadoCard filas={a.por_empleado} />
      <PorSedeCard filas={a.por_sucursal} />
      <HorasPicoCard horas={a.horas_pico} />
      <RecurrenciaCard recurrencia={a.recurrencia} cancelaciones={a.cancelaciones} />
    </section>
  );
}
