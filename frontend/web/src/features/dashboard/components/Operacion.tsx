import {
  AlarmClock,
  ArrowRight,
  CalendarClock,
  CalendarX,
  CircleCheck,
  Star,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { CitaPanel } from "@/api/citas";
import type { Dashboard } from "@/api/dashboard";
import { EstadoCitaBadge } from "@/components/common/EstadoCitaBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { aviso } from "@/components/ui/toaster";
import { useAgenda, useAhora, useAtencion } from "@/features/agenda/hooks/useAgenda";
import { nombreCompleto, plazoCorto, textoMotivoFuera, textoPlazo } from "@/features/agenda/textos";
import { useActualizarNegocio } from "@/features/negocios/hooks/useGestion";
import { hora } from "@/lib/format";
import { plural } from "../textos";

const ESTADOS_DEL_DIA: CitaPanel["estado"][] = [
  "pendiente",
  "confirmada",
  "en_curso",
  "completada",
  "no_asistio",
];
const MAXIMO_CITAS = 6;

function Titulo({ children, enlace }: { children: ReactNode; enlace?: { a: string; texto: string } }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-card font-semibold text-ink">{children}</h2>
      {enlace && (
        <Link
          to={enlace.a}
          className="flex items-center gap-1 text-body font-semibold text-primary hover:underline"
        >
          {enlace.texto} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Citas de hoy (con citas.ver): sin canceladas ni reprogramadas, en orden; cada una abre su detalle. */
export function CitasDeHoy({
  idNegocio,
  hoy,
  idSucursal,
}: {
  idNegocio: number;
  hoy: string;
  idSucursal?: number;
}) {
  const agenda = useAgenda(
    idNegocio,
    { desde: hoy, hasta: hoy, estados: ESTADOS_DEL_DIA, id_sucursal: idSucursal },
    true,
  );
  const ahora = useAhora();
  const citas = [...(agenda.data ?? [])].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  const visibles = citas.slice(0, MAXIMO_CITAS);
  const resto = citas.length - visibles.length;

  return (
    <Card className="p-5">
      <Titulo enlace={{ a: `../agenda?vista=dia&fecha=${hoy}`, texto: "Ver agenda" }}>Citas de hoy</Titulo>
      {agenda.isPending ? (
        <Skeleton className="h-40" />
      ) : agenda.isError ? (
        <p className="text-body text-muted">No se pudieron cargar las citas de hoy.</p>
      ) : citas.length === 0 ? (
        <p className="py-6 text-center text-body text-muted">No hay citas para hoy.</p>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((c) => (
            <li key={c.id_cita} className="border-b last:border-b-0">
              <Link
                to={`../agenda?fecha=${hoy}&cita=${c.id_cita}`}
                className="flex items-center gap-4 rounded-control px-1 py-2.5 hover:bg-selected"
              >
                <span className="w-12 shrink-0 text-body font-semibold text-ink tabular-nums">
                  {hora(c.hora_inicio)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">
                    {c.mascota.nombre} — {c.servicio.nombre}
                  </span>
                  <span className="block truncate text-label text-muted">{nombreCompleto(c.cliente)}</span>
                </span>
                <EstadoCitaBadge
                  estado={c.estado}
                  fueraDeDisponibilidad={c.fuera_de_disponibilidad}
                  plazo={c.estado === "pendiente" ? plazoCorto(c, ahora) : null}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {resto > 0 && (
        <p className="mt-2 text-label text-muted">Y {plural(resto, "cita más", "citas más")} en la agenda.</p>
      )}
    </Card>
  );
}

/**
 * Citas que se cancelaron solas porque nadie las confirmó. Solo con la sugerencia de la API
 * (hubo alguna y la confirmación automática está apagada); activarla pide configuracion.editar.
 */
export function CitasPerdidas({
  idNegocio,
  perdidas,
  puedeActivar,
}: {
  idNegocio: number;
  perdidas: Dashboard["citas_perdidas_por_no_confirmar"];
  puedeActivar: boolean;
}) {
  const actualizar = useActualizarNegocio(idNegocio);
  if (!perdidas.sugerencia) return null;
  const activar = () =>
    actualizar.mutate(
      { confirmacion_automatica: true },
      {
        onSuccess: () => aviso.exito("Confirmación automática activada"),
        onError: (e) => aviso.error(e.message),
      },
    );
  return (
    <Card className="border-warning/40 bg-warning-soft p-5">
      <h2 className="flex items-center gap-2 text-card font-semibold text-warning-ink">
        <AlarmClock className="size-5" aria-hidden />
        {plural(perdidas.total, "cita perdida", "citas perdidas")} por no confirmar
      </h2>
      <p className="mt-2 text-body text-warning-ink">{perdidas.sugerencia.mensaje}</p>
      {puedeActivar ? (
        <Button className="mt-3" onClick={activar} cargando={actualizar.isPending}>
          Activar confirmación automática
        </Button>
      ) : (
        <p className="mt-2 text-label text-warning-ink">
          Pídele al propietario que la active en Configuración.
        </p>
      )}
    </Card>
  );
}

function Fila({
  icono: Icono,
  tono,
  children,
  a,
}: {
  icono: LucideIcon;
  tono: string;
  children: ReactNode;
  a?: string;
}) {
  const contenido = (
    <>
      <Icono className={`mt-0.5 size-4 shrink-0 ${tono}`} aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {a && <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />}
    </>
  );
  return (
    <li>
      {a ? (
        <Link
          to={a}
          className="flex items-start gap-2.5 rounded-control px-1 py-1.5 text-body text-ink hover:bg-selected"
        >
          {contenido}
        </Link>
      ) : (
        <div className="flex items-start gap-2.5 px-1 py-1.5 text-body text-ink">{contenido}</div>
      )}
    </li>
  );
}

/**
 * Lo que espera una acción: pendientes por confirmar y citas fuera de disponibilidad (de la
 * atención de la agenda, con citas.ver), reseñas sin responder y mascotas con vacunas
 * vencidas en los últimos 30 días. Solo las filas con algo.
 */
export function RequiereAtencion({
  idNegocio,
  datos,
  verCitas,
  idSucursal,
}: {
  idNegocio: number;
  datos: Dashboard;
  verCitas: boolean;
  idSucursal?: number;
}) {
  const atencion = useAtencion(idNegocio, { id_sucursal: idSucursal }, verCitas);
  const ahora = useAhora();
  const pendientes = atencion.data?.por_confirmar ?? [];
  const fuera = atencion.data?.fuera_de_disponibilidad ?? [];
  const porConfirmar = verCitas ? pendientes.length : datos.hoy.por_confirmar;
  const primera = pendientes[0];
  const plazo = primera ? textoPlazo(primera, ahora) : null;
  const { sin_responder } = datos.calificacion;
  const { mascotas, dias } = datos.vacunas_vencidas;
  const nada = porConfirmar === 0 && fuera.length === 0 && sin_responder === 0 && mascotas === 0;

  return (
    <Card className="p-5">
      <Titulo>Requiere tu atención</Titulo>
      {verCitas && atencion.isPending ? (
        <Skeleton className="h-24" />
      ) : nada ? (
        <p className="flex items-center gap-2 text-body text-muted">
          <CircleCheck className="size-4 text-primary" aria-hidden /> Todo al día.
        </p>
      ) : (
        <ul className="flex flex-col">
          {porConfirmar > 0 && (
            <Fila icono={CalendarClock} tono="text-warning" a={verCitas ? "../agenda" : undefined}>
              {plural(porConfirmar, "cita pendiente", "citas pendientes")} por confirmar
              {plazo && <span className="text-muted"> · la primera {plazo.toLowerCase()}</span>}
            </Fila>
          )}
          {fuera.length > 0 && (
            <Fila icono={CalendarX} tono="text-warning-ink" a="../agenda?vista=lista&fuera=1">
              {plural(fuera.length, "cita fuera", "citas fuera")} de la disponibilidad
              {fuera.length === 1 && fuera[0] && (
                <span className="text-muted"> · {textoMotivoFuera(fuera[0])}</span>
              )}
            </Fila>
          )}
          {sin_responder > 0 && (
            <Fila icono={Star} tono="text-warning" a="../resenas">
              {plural(sin_responder, "reseña sin responder", "reseñas sin responder")}
            </Fila>
          )}
          {mascotas > 0 && (
            <Fila icono={Syringe} tono="text-muted">
              {plural(mascotas, "mascota", "mascotas")} con vacunas vencidas en los últimos {dias} días
            </Fila>
          )}
        </ul>
      )}
    </Card>
  );
}
