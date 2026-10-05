import { X } from "lucide-react";
import { Link } from "react-router";
import type { CitaPanel, FiltrosAgenda } from "@/api/citas";
import type { Profesional } from "@/api/empleados";
import { SinPermiso } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSedes } from "@/features/equipo/hooks/useDisponibilidad";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { diasDeSemana, sumarDias, tituloDia, tituloRango } from "@/lib/agenda";
import { hoyISO, minutoActualBogota } from "@/lib/format";
import { BarraAgenda } from "../components/BarraAgenda";
import { PanelAtencion } from "../components/PanelAtencion";
import { VistaDia } from "../components/VistaDia";
import { VistaLista } from "../components/VistaLista";
import { VistaSemana } from "../components/VistaSemana";
import { useAgenda, useAhora, useAtencion, useFiltrosUrl, useProfesionales } from "../hooks/useAgenda";

/** Columna de un profesional que ya no está en la lista (inactivo) pero tiene citas ese día. */
const profesionalDeCita = (e: NonNullable<CitaPanel["empleado"]>): Profesional => ({
  ...e,
  especialidad: null,
  foto_url: null,
  foto_miniatura_url: null,
  rol: { id_rol: 0, nombre: "" },
  servicios: [],
});

/**
 * B3 · B9 · B10 · Agenda: Semana, Día por profesional y Lista, con los filtros en la URL y
 * el panel "Por confirmar" / "Fuera de disponibilidad". Requiere citas.ver. Al elegir una
 * cita queda en la URL (`?cita=`); el detalle (B4) llega en P4.2.
 */
export function AgendaPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const verCitas = puede("citas", "ver");
  const [filtros, cambiar] = useFiltrosUrl();
  const ahora = useAhora();
  const hoy = hoyISO(ahora);
  const { sedes } = useSedes();
  const profesionales = useProfesionales(negocio.id_negocio, verCitas);

  const filtrosApi: FiltrosAgenda = {
    id_sucursal: filtros.idSucursal,
    id_empleado: filtros.mias ? undefined : filtros.idEmpleado,
    solo_mias: filtros.mias || undefined,
  };
  const dias = diasDeSemana(filtros.fecha);
  const [desde, hasta] = filtros.vista === "dia" ? [filtros.fecha, filtros.fecha] : [dias[0]!, dias[6]!];
  const soloFuera = filtros.vista === "lista" && filtros.fuera;
  const agenda = useAgenda(
    negocio.id_negocio,
    { desde, hasta, estados: filtros.estados, ...filtrosApi },
    verCitas && !soloFuera,
  );
  const atencion = useAtencion(negocio.id_negocio, filtrosApi, verCitas);

  if (!verCitas) {
    return (
      <Card>
        <SinPermiso />
      </Card>
    );
  }

  const paso = filtros.vista === "dia" ? 1 : 7;
  const titulo = filtros.vista === "dia" ? tituloDia(filtros.fecha) : tituloRango(dias[0]!, dias[6]!);
  // Abrir una cita fija también su fecha: "Día" muestra el día de la cita, y una cita de
  // otra semana (desde el panel lateral) lleva a esa semana. Dentro del mismo rango no
  // llena el historial.
  const abrir = (cita: CitaPanel) =>
    cambiar(
      { fecha: cita.fecha, idCita: cita.id_cita },
      { reemplazar: cita.fecha >= desde && cita.fecha <= hasta },
    );

  const sedesVisibles = (sedes ?? []).filter(
    (s) => filtros.idSucursal === undefined || s.id_sucursal === filtros.idSucursal,
  );
  const nombreSede =
    sedesVisibles.length === 1
      ? sedesVisibles[0]!.nombre
      : (sedes?.length ?? 0) > 1
        ? "Todas las sedes"
        : null;
  const citas = soloFuera ? (atencion.data?.fuera_de_disponibilidad ?? []) : (agenda.data ?? []);
  const total = soloFuera ? null : agenda.data?.length;

  return (
    <div>
      <p className="mb-3 text-body text-muted" aria-live="polite">
        {[nombreSede, total !== undefined && total !== null && textoTotal(total, filtros.vista)]
          .filter(Boolean)
          .join(" · ") || " "}
      </p>
      <BarraAgenda
        filtros={filtros}
        cambiar={cambiar}
        titulo={titulo}
        profesionales={profesionales.data ?? []}
        sedes={sedes ?? []}
        conPerfilPropio={negocio.id_empleado !== null}
        puedeCrear={puede("citas", "crear")}
        onAnterior={() => cambiar({ fecha: sumarDias(filtros.fecha, -paso), idCita: undefined })}
        onSiguiente={() => cambiar({ fecha: sumarDias(filtros.fecha, paso), idCita: undefined })}
        onHoy={() => cambiar({ fecha: hoy, idCita: undefined })}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-4">
        <div className="min-w-0">
          {soloFuera && (
            <div className="mb-3 flex items-center gap-2 text-body text-ink">
              Citas fuera de disponibilidad, desde hoy
              <Button variant="ghost" size="sm" onClick={() => cambiar({ fuera: undefined })}>
                <X /> Ver la semana
              </Button>
            </div>
          )}

          {(soloFuera ? atencion.isPending : agenda.isPending) || !sedes ? (
            <Skeleton className="h-[560px] rounded-card" />
          ) : !soloFuera && agenda.isError ? (
            <Card>
              <ErrorConsulta error={agenda.error} reintentar={() => void agenda.refetch()} />
            </Card>
          ) : filtros.vista === "semana" ? (
            <VistaSemana
              dias={dias}
              citas={citas}
              sedes={sedesVisibles}
              hoy={hoy}
              minutoActual={minutoActualBogota(ahora)}
              idSeleccionada={filtros.idCita}
              onAbrir={abrir}
            />
          ) : filtros.vista === "dia" ? (
            <VistaDia
              fecha={filtros.fecha}
              citas={citas}
              profesionales={columnasDelDia(
                profesionales.data ?? [],
                citas,
                filtros.mias ? negocio.id_empleado : filtros.idEmpleado,
              )}
              idSucursal={filtros.idSucursal}
              sedes={sedesVisibles}
              hoy={hoy}
              minutoActual={minutoActualBogota(ahora)}
              idSeleccionada={filtros.idCita}
              onAbrir={abrir}
            />
          ) : (
            <VistaLista
              citas={citas}
              hoy={hoy}
              ahora={ahora}
              vacio={soloFuera ? "No hay citas fuera de disponibilidad" : "No hay citas en esta semana"}
              idSeleccionada={filtros.idCita}
              onAbrir={abrir}
            />
          )}
        </div>

        <aside aria-label="Citas por atender" className="flex flex-col gap-4">
          <PanelAtencion
            atencion={atencion.data}
            error={atencion.error}
            ahora={ahora}
            idSeleccionada={filtros.idCita}
            onAbrir={abrir}
          />
          {atencion.data && atencion.data.fuera_de_disponibilidad.length > 0 && !soloFuera && (
            <Link
              to="?vista=lista&fuera=1"
              className="px-1 text-label font-semibold text-primary hover:underline"
            >
              Ver todas las citas fuera de disponibilidad →
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function textoTotal(total: number, vista: string) {
  const citas = `${total} ${total === 1 ? "cita" : "citas"}`;
  return vista === "dia" ? `${citas} este día` : `${citas} esta semana`;
}

/**
 * Columnas de la vista Día: el profesional elegido (o el propio con "Solo mis citas") o
 * todos los que atienden servicios, más quien tenga citas ese día aunque ya no esté.
 */
function columnasDelDia(
  profesionales: Profesional[],
  citas: CitaPanel[],
  idElegido: number | null | undefined,
) {
  if (idElegido) {
    const elegido = profesionales.find((p) => p.id_empleado === idElegido);
    const deCita = citas.find((c) => c.empleado?.id_empleado === idElegido)?.empleado;
    return elegido ? [elegido] : deCita ? [profesionalDeCita(deCita)] : [];
  }
  const columnas = profesionales.filter((p) => p.servicios.length > 0);
  for (const c of citas) {
    if (c.empleado && !columnas.some((p) => p.id_empleado === c.empleado!.id_empleado)) {
      columnas.push(
        profesionales.find((p) => p.id_empleado === c.empleado!.id_empleado) ?? profesionalDeCita(c.empleado),
      );
    }
  }
  return columnas;
}
