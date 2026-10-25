import { ArrowDown, ArrowUp, CalendarRange, Info, Lock, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { ApiError } from "@/api/errors";
import type { Dashboard } from "@/api/dashboard";
import { estaBloqueada } from "@/api/dashboard";
import { SinPermiso, Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { useSedes } from "@/features/equipo/hooks/useDisponibilidad";
import { useNegocioActivo, usePuede, useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { BotonesPlan } from "@/features/suscripcion/components/PruebaPro";
import { dinero, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Analisis } from "../components/Analisis";
import { CitasDeHoy, CitasPerdidas, RequiereAtencion } from "../components/Operacion";
import { useDashboard, useFiltrosDashboard, type FiltrosDashboard } from "../hooks/useDashboard";
import { PERIODOS, SOLO_AVANZADO, textoRango, type Periodo } from "../periodos";
import { plural, porcentaje, variacionPct, variacionPuntos, type Variacion } from "../textos";

const TODAS = "todas";

/** B1 / B2 · Dashboard: indicadores del periodo, el día de hoy y el análisis (avanzado en Pro). */
export function DashboardPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const verDashboard = puede("reportes", "ver");
  const [filtros, cambiar] = useFiltrosDashboard();
  const dashboard = useDashboard(
    negocio.id_negocio,
    { desde: filtros.desde, hasta: filtros.hasta, id_sucursal: filtros.idSucursal },
    verDashboard,
  );

  if (!verDashboard) {
    return (
      <Card>
        <SinPermiso
          acciones={
            <Button asChild variant="secondary">
              <Link to="..">Volver al inicio</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const datos = dashboard.data;
  const errorRango =
    dashboard.error?.status === 422 && dashboard.error.errors.plan_requerido ? dashboard.error : null;

  return (
    <div className="flex flex-col gap-5">
      <Filtros filtros={filtros} cambiar={cambiar} datos={datos} />
      {errorRango ? (
        <InvitacionRango error={errorRango} onVolver={() => cambiar({ periodo: "30" })} />
      ) : dashboard.isError ? (
        <Card>
          <ErrorConsulta error={dashboard.error} reintentar={() => void dashboard.refetch()} />
        </Card>
      ) : !datos ? (
        <Cargando />
      ) : (
        <Contenido datos={datos} idSucursal={filtros.idSucursal} cargando={dashboard.isPlaceholderData} />
      )}
    </div>
  );
}

function Cargando() {
  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
    </>
  );
}

function Filtros({
  filtros,
  cambiar,
  datos,
}: {
  filtros: FiltrosDashboard;
  cambiar: ReturnType<typeof useFiltrosDashboard>[1];
  datos: Dashboard | undefined;
}) {
  const { sedes } = useSedes();
  const hoy = hoyISO();
  const textoPeriodo = PERIODOS.find((p) => p.valor === filtros.periodo)?.texto ?? "";
  // Hasta conocer el plan, el periodo de 12 meses se ofrece igual: la API decide.
  const avanzado = datos?.plan.estadisticas_avanzadas ?? true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filtros.periodo} onValueChange={(valor) => cambiar({ periodo: valor as Periodo })}>
        <SelectTrigger aria-label="Periodo" className="w-auto min-w-64">
          <span className="flex items-center gap-2">
            <CalendarRange className="size-4 text-muted" aria-hidden />
            {textoPeriodo} · {textoRango(filtros)}
          </span>
        </SelectTrigger>
        <SelectContent>
          {PERIODOS.map((p) => (
            <SelectItem key={p.valor} value={p.valor}>
              <span className="flex items-center gap-2">
                {p.texto}
                {!avanzado && SOLO_AVANZADO.includes(p.valor) && (
                  <Badge tono="info">
                    <Lock className="size-3" aria-hidden /> Pro
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtros.periodo === "personalizado" && (
        <RangoPersonalizado filtros={filtros} hoy={hoy} cambiar={cambiar} />
      )}
      {sedes && sedes.length > 1 && (
        <Select
          value={filtros.idSucursal ? String(filtros.idSucursal) : TODAS}
          onValueChange={(valor) => cambiar({ idSucursal: valor === TODAS ? null : Number(valor) })}
        >
          <SelectTrigger aria-label="Sede" className="w-auto min-w-44">
            <span>
              {filtros.idSucursal
                ? (sedes.find((s) => s.id_sucursal === filtros.idSucursal)?.nombre ?? "Sede")
                : "Todas las sedes"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las sedes</SelectItem>
            {sedes.map((s) => (
              <SelectItem key={s.id_sucursal} value={String(s.id_sucursal)}>
                {s.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <EtiquetaPlan datos={datos} />
      <p className="ml-auto text-label text-muted">
        Ingresos registrados, no pagos verificados (hasta la Fase 3)
      </p>
    </div>
  );
}

function RangoPersonalizado({
  filtros,
  hoy,
  cambiar,
}: {
  filtros: FiltrosDashboard;
  hoy: string;
  cambiar: ReturnType<typeof useFiltrosDashboard>[1];
}) {
  const [desde, setDesde] = useState(filtros.desde);
  const [hasta, setHasta] = useState(filtros.hasta);
  const valido = Boolean(desde && hasta && desde <= hasta && hasta <= hoy);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) cambiar({ periodo: "personalizado", desde, hasta });
      }}
    >
      <Input
        type="date"
        aria-label="Desde"
        value={desde}
        max={hasta || hoy}
        onChange={(e) => setDesde(e.target.value)}
        className="w-40"
      />
      <span className="text-muted">–</span>
      <Input
        type="date"
        aria-label="Hasta"
        value={hasta}
        min={desde}
        max={hoy}
        onChange={(e) => setHasta(e.target.value)}
        className="w-40"
      />
      <Button type="submit" variant="secondary" disabled={!valido}>
        Aplicar
      </Button>
    </form>
  );
}

/** "Plan Pro" o, con un límite de citas, "Plan Gratuito · 22 de 30 citas este mes". */
function EtiquetaPlan({ datos }: { datos: Dashboard | undefined }) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const suscripcion = useSuscripcion(negocio.id_negocio, puede("configuracion", "ver"));
  if (!datos) return null;
  const citas = suscripcion.data?.uso.citas_mes;
  const conLimite = citas && citas.maximo !== -1;
  return (
    <Badge tono={conLimite ? "warning" : "primary"}>
      Plan {datos.plan.nombre}
      {conLimite && ` · ${citas.usadas} de ${citas.maximo} citas este mes`}
    </Badge>
  );
}

/** El rango pedido pasa del plan (422 con `plan_requerido`): invitación a Pro en lugar de un error. */
function InvitacionRango({ error, onVolver }: { error: ApiError; onVolver: () => void }) {
  const plan = error.errors.plan_requerido;
  return (
    <Card>
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-info-soft text-info">
          <Lock className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-title font-bold text-ink">{error.message}</h2>
        <p className="mt-2 max-w-md text-body text-muted">
          Con el plan {plan} consultas hasta 12 meses de historia, comparas con el periodo anterior y ves el
          rendimiento de cada profesional y sede.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <BotonesPlan />
          <Button variant="ghost" onClick={onVolver}>
            Ver los últimos 30 días
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Contenido({
  datos,
  idSucursal,
  cargando,
}: {
  datos: Dashboard;
  idSucursal?: number;
  cargando: boolean;
}) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const verCitas = puede("citas", "ver");
  const sinCitas = datos.citas.total === 0 && datos.hoy.total === 0;

  return (
    <div
      className={cn("flex flex-col gap-5 transition-opacity", cargando && "opacity-60")}
      aria-busy={cargando}
    >
      <Indicadores datos={datos} />
      <div
        className={cn("grid items-start gap-5", verCitas ? "grid-cols-[minmax(0,1fr)_400px]" : "grid-cols-1")}
      >
        {verCitas && (
          <CitasDeHoy idNegocio={negocio.id_negocio} hoy={datos.hoy.fecha} idSucursal={idSucursal} />
        )}
        <div className={cn("flex flex-col gap-5", !verCitas && "grid grid-cols-2")}>
          <CitasPerdidas
            idNegocio={negocio.id_negocio}
            perdidas={datos.citas_perdidas_por_no_confirmar}
            puedeActivar={puede("configuracion", "editar")}
          />
          <RequiereAtencion
            idNegocio={negocio.id_negocio}
            datos={datos}
            verCitas={verCitas}
            idSucursal={idSucursal}
          />
        </div>
      </div>
      {sinCitas ? (
        <Card>
          <Vacio
            titulo="Sin citas en este periodo"
            descripcion="Cuando haya citas, aquí verás su tendencia y quién las atiende."
          />
        </Card>
      ) : (
        <Analisis datos={datos} />
      )}
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalle,
  ayuda,
}: {
  titulo: string;
  valor: ReactNode;
  detalle: ReactNode;
  ayuda?: string;
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-body text-muted">
        {titulo}
        {ayuda && (
          <Tooltip texto={ayuda}>
            <button
              type="button"
              aria-label={`Qué incluye: ${titulo}`}
              className="text-subtle hover:text-muted"
            >
              <Info className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </p>
      <p className="mt-1 text-[28px] leading-tight font-bold text-ink tabular-nums">{valor}</p>
      <div className="mt-1 text-label">{detalle}</div>
    </Card>
  );
}

function TextoVariacion({ variacion, otro }: { variacion: Variacion | null; otro: string }) {
  if (!variacion) return <span className="text-muted">{otro}</span>;
  const Flecha = variacion.sentido === "sube" ? ArrowUp : variacion.sentido === "baja" ? ArrowDown : null;
  return (
    <span className={cn("flex items-center gap-1", variacion.bueno ? "text-primary-dark" : "text-danger")}>
      {Flecha && <Flecha className="size-3" aria-hidden />}
      {variacion.texto}
    </span>
  );
}

function Indicadores({ datos }: { datos: Dashboard }) {
  const comparacion = estaBloqueada(datos.avanzadas.comparacion) ? null : datos.avanzadas.comparacion;
  const { hoy, ingresos, tasa_inasistencia: tasa, calificacion } = datos;
  return (
    <section aria-label="Indicadores del periodo" className="grid grid-cols-5 gap-4">
      <Indicador
        titulo="Citas hoy"
        valor={hoy.total}
        detalle={
          hoy.por_confirmar > 0 ? (
            <span className="text-warning-ink">{hoy.por_confirmar} por confirmar</span>
          ) : (
            <span className="text-muted">Ninguna por confirmar</span>
          )
        }
      />
      <Indicador
        titulo="Ingresos registrados"
        ayuda={ingresos.nota}
        valor={dinero(ingresos.total)}
        detalle={
          <TextoVariacion
            variacion={comparacion && variacionPct(comparacion.variacion_pct.ingresos)}
            otro={plural(ingresos.citas_completadas, "cita completada", "citas completadas")}
          />
        }
      />
      <Indicador
        titulo="Clientes nuevos"
        valor={datos.clientes_nuevos}
        detalle={
          <TextoVariacion
            variacion={comparacion && variacionPct(comparacion.variacion_pct.clientes_nuevos)}
            otro="En el periodo"
          />
        }
      />
      <Indicador
        titulo="Tasa de inasistencia"
        valor={porcentaje(tasa.porcentaje)}
        detalle={
          <TextoVariacion
            variacion={
              comparacion &&
              variacionPuntos(comparacion.actual.tasa_inasistencia, comparacion.anterior.tasa_inasistencia)
            }
            otro={tasa.base > 0 ? `${tasa.inasistencias} de ${tasa.base} citas` : "Sin citas atendidas"}
          />
        }
      />
      <Indicador
        titulo="Calificación"
        valor={
          calificacion.total_resenas > 0 ? (
            <span className="flex items-center gap-1">
              {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(calificacion.promedio)}
              <Star className="size-6 fill-warning text-warning" aria-label="estrellas" />
            </span>
          ) : (
            "—"
          )
        }
        detalle={
          <span className="text-muted">
            {plural(calificacion.total_resenas, "reseña", "reseñas")}
            {calificacion.sin_responder > 0 && (
              <span className="text-warning-ink"> · {calificacion.sin_responder} sin responder</span>
            )}
          </span>
        }
      />
    </section>
  );
}
