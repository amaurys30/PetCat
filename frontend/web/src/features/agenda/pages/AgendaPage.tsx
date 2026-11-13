import { WifiOff, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { CitaPanel, FiltrosAgenda } from "@/api/citas";
import type { Profesional } from "@/api/empleados";
import { SinPermiso } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { aviso } from "@/components/ui/toaster";
import { useSedes } from "@/features/equipo/hooks/useDisponibilidad";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { aHora, diasDeSemana, sumarDias, tituloDia, tituloRango } from "@/lib/agenda";
import { hoyISO, minutoActualBogota } from "@/lib/format";
import { useEstadoConexion } from "@/lib/socket";
import { useUi } from "@/stores/ui";
import { BarraAgenda } from "../components/BarraAgenda";
import { DetalleCita } from "../components/DetalleCita";
import { PanelAtencion } from "../components/PanelAtencion";
import { VistaDia } from "../components/VistaDia";
import { VistaLista } from "../components/VistaLista";
import { VistaSemana } from "../components/VistaSemana";
import { NuevaCitaDialog, type InicioNuevaCita } from "../components/nueva/NuevaCitaDialog";
import { useAgenda, useAhora, useAtencion, useFiltrosUrl, useProfesionales } from "../hooks/useAgenda";
import { useCambiarEstado } from "../hooks/useCita";

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
 * cita queda en la URL (`?cita=`) y se abre su detalle (B4) en un panel lateral. Sin
 * citas.ver_todas, solo las citas propias: la API las limita y aquí no hay filtro de profesional.
 */
export function AgendaPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const verCitas = puede("citas", "ver");
  const verTodas = puede("citas", "ver_todas");
  const [filtros, cambiar] = useFiltrosUrl();
  const ahora = useAhora();
  const hoy = hoyISO(ahora);
  const { sedes } = useSedes();
  const profesionales = useProfesionales(negocio.id_negocio, verCitas);

  // Sin ver_todas no se envía profesional: la API devuelve solo las propias (otro daría 403).
  const filtrosApi: FiltrosAgenda = {
    id_sucursal: filtros.idSucursal,
    id_empleado: verTodas && !filtros.mias ? filtros.idEmpleado : undefined,
    solo_mias: (verTodas && filtros.mias) || undefined,
  };
  const idProfesional = !verTodas || filtros.mias ? negocio.id_empleado : filtros.idEmpleado;
  const dias = diasDeSemana(filtros.fecha);
  const [desde, hasta] = filtros.vista === "dia" ? [filtros.fecha, filtros.fecha] : [dias[0]!, dias[6]!];
  const soloFuera = filtros.vista === "lista" && filtros.fuera;
  const agenda = useAgenda(
    negocio.id_negocio,
    { desde, hasta, estados: filtros.estados, ...filtrosApi },
    verCitas && !soloFuera,
  );
  const atencion = useAtencion(negocio.id_negocio, filtrosApi, verCitas);
  const confirmar = useCambiarEstado(negocio.id_negocio);
  const abrirAccion = useUi((s) => s.abrirAccionCita);
  const puedeCrear = puede("citas", "crear");
  // "Agendar cita" desde otra pantalla (C1) llega en el estado de la navegación; se borra
  // al abrir, para que volver o recargar no abra B5 otra vez.
  const location = useLocation();
  const navigate = useNavigate();
  const recibida = (location.state as { nuevaCita?: InicioNuevaCita } | null)?.nuevaCita;
  const [nuevaCita, setNuevaCita] = useState<InicioNuevaCita | null>(
    puedeCrear && recibida ? recibida : null,
  );
  const olvidarRecibida = useEffectEvent(() => {
    if (recibida)
      void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  });
  useEffect(() => olvidarRecibida(), []);
  const conexion = useEstadoConexion();

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
      <div className="mb-3 flex items-center gap-4">
        <p className="text-body text-muted" aria-live="polite">
          {[nombreSede, total !== undefined && total !== null && textoTotal(total, filtros.vista)]
            .filter(Boolean)
            .join(" · ") || " "}
        </p>
        {conexion === "desconectado" && (
          <p role="status" className="ml-auto flex items-center gap-1.5 text-body text-warning-ink">
            <WifiOff className="size-3.5" aria-hidden />
            Sin actualización en tiempo real · reintentando
          </p>
        )}
      </div>
      <BarraAgenda
        filtros={filtros}
        cambiar={cambiar}
        titulo={titulo}
        profesionales={profesionales.data ?? []}
        sedes={sedes ?? []}
        conPerfilPropio={negocio.id_empleado !== null}
        verTodas={verTodas}
        puedeCrear={puedeCrear}
        onNuevaCita={() => setNuevaCita({ fecha: filtros.vista === "dia" ? filtros.fecha : undefined })}
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
            <Skeleton etiqueta="Cargando agenda" className="h-[560px] rounded-card" />
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
              onHueco={
                puedeCrear ? (dia, minuto) => setNuevaCita({ fecha: dia, hora: aHora(minuto) }) : undefined
              }
            />
          ) : filtros.vista === "dia" ? (
            <VistaDia
              fecha={filtros.fecha}
              citas={citas}
              profesionales={columnasDelDia(profesionales.data ?? [], citas, idProfesional)}
              idSucursal={filtros.idSucursal}
              sedes={sedesVisibles}
              hoy={hoy}
              minutoActual={minutoActualBogota(ahora)}
              idSeleccionada={filtros.idCita}
              onAbrir={abrir}
              onHueco={
                puedeCrear
                  ? (columna, minuto) =>
                      setNuevaCita({
                        fecha: filtros.fecha,
                        hora: aHora(minuto),
                        idEmpleado: Number(columna) || undefined,
                      })
                  : undefined
              }
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
            permisos={{
              editar: puede("citas", "editar"),
              cancelar: puede("citas", "cancelar"),
              reasignar: puede("citas", "editar") && verTodas,
            }}
            confirmando={confirmar.isPending ? confirmar.variables.idCita : undefined}
            onConfirmar={(c) =>
              confirmar.mutate(
                { idCita: c.id_cita, estado: "confirmada" },
                { onError: (e) => aviso.advertencia(e.message) },
              )
            }
            onAccion={(tipo, c) => abrirAccion(tipo, c.id_cita)}
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

      {filtros.idCita !== undefined && (
        <DetalleCita idCita={filtros.idCita} onCerrar={() => cambiar({ idCita: undefined })} />
      )}
      {nuevaCita && (
        <NuevaCitaDialog
          inicio={nuevaCita}
          onCerrar={() => setNuevaCita(null)}
          onCreada={(cita) => {
            setNuevaCita(null);
            cambiar({ fecha: cita.fecha, idCita: cita.id_cita });
          }}
        />
      )}
    </div>
  );
}

function textoTotal(total: number, vista: string) {
  const citas = `${total} ${total === 1 ? "cita" : "citas"}`;
  return vista === "dia" ? `${citas} este día` : `${citas} esta semana`;
}

/**
 * Columnas de la vista Día: el profesional elegido (o el propio con "Solo mis citas" o sin
 * citas.ver_todas) o
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
