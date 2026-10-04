import { CalendarOff, MoreHorizontal, Palmtree, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import type { Disponibilidad, Excepcion, TipoExcepcion } from "@/api/disponibilidad";
import type { CitaAfectada } from "@/api/negocios";
import { AvisoCambiosSinGuardar } from "@/components/common/AvisoCambiosSinGuardar";
import { textoCitasFuera } from "@/lib/citas";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Cargando, NoEncontrado, SinPermiso } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { aviso } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { usePuede } from "@/features/negocios/hooks/useNegocio";
import {
  erroresSemanaProfesional,
  semanaDesdeSede,
  semanaProfesionalAApi,
  semanaProfesionalDesdeApi,
  semanasProfesionalIguales,
  type SemanaProfesional,
} from "@/lib/disponibilidad";
import { fechaCorta, fechaLargaTitulo, hora, hoyISO } from "@/lib/format";
import { semanaDesdeApi, textoRangos } from "@/lib/horarios";
import { useAuth } from "@/stores/auth";
import { useUi } from "@/stores/ui";
import { EditorHorarioProfesional } from "../components/EditorHorarioProfesional";
import { ExcepcionDialog } from "../components/ExcepcionDialog";
import { NOMBRE_TIPO } from "../textos";
import {
  useDisponibilidad,
  useDisponibilidadEfectiva,
  useEliminarExcepcion,
  useGuardarHorarioSemanal,
  useSedes,
  type SedeHorario,
} from "../hooks/useDisponibilidad";
import { useEmpleado, useEscalada } from "../hooks/useEquipo";

const ICONO = { bloqueo: CalendarOff, vacacion: Palmtree, evento_especial: Sparkles } as const;
const TONO = { bloqueo: "danger", vacacion: "warning", evento_especial: "primary" } as const;
const ELIMINADA = {
  bloqueo: "Bloqueo eliminado",
  vacacion: "Vacaciones eliminadas",
  evento_especial: "Evento especial eliminado",
} as const;

interface Afectadas {
  citas: CitaAfectada[];
  guardado: string;
}

/**
 * D5 · Disponibilidad del profesional: horario semanal (con su sede), excepciones y la
 * disponibilidad efectiva de un día. Ver: configuracion.ver, citas.ver o el propio empleado;
 * editar: configuracion.editar.
 */
export function DisponibilidadPage() {
  const idEmpleado = Number(useParams().idEmpleado);
  const puede = usePuede();
  const escalada = useEscalada();
  const usuario = useAuth((s) => s.usuario);
  const esYo = escalada.esYo(idEmpleado);
  const puedeVer = puede("configuracion", "ver") || puede("citas", "ver") || esYo;
  const empleado = useEmpleado(idEmpleado, puede("empleados", "ver"));
  const disponibilidad = useDisponibilidad(idEmpleado);
  const { sedes } = useSedes();

  if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) return <NoEncontrado />;
  if (!puedeVer) {
    return (
      <Card>
        <SinPermiso />
      </Card>
    );
  }
  const error = disponibilidad.error ?? empleado.error;
  if (error) {
    return (
      <Card>
        <ErrorConsulta error={error} reintentar={() => void disponibilidad.refetch()} />
      </Card>
    );
  }
  if (!disponibilidad.data || !sedes || (puede("empleados", "ver") && !empleado.data)) {
    return (
      <Card>
        <Cargando lineas={8} />
      </Card>
    );
  }

  const nombre = empleado.data
    ? `${empleado.data.nombre} ${empleado.data.apellido}`
    : esYo && usuario
      ? `${usuario.nombre} ${usuario.apellido}`
      : "Profesional";
  const activo = empleado.data?.activo ?? true;

  return (
    <Contenido
      key={idEmpleado}
      idEmpleado={idEmpleado}
      nombre={nombre}
      activo={activo}
      disponibilidad={disponibilidad.data}
      sedes={sedes}
      puedeEditar={puede("configuracion", "editar") && activo}
    />
  );
}

function Contenido({
  idEmpleado,
  nombre,
  activo,
  disponibilidad,
  sedes,
  puedeEditar,
}: {
  idEmpleado: number;
  nombre: string;
  activo: boolean;
  disponibilidad: Disponibilidad;
  sedes: SedeHorario[];
  puedeEditar: boolean;
}) {
  const puede = usePuede();
  const [afectadas, setAfectadas] = useState<Afectadas | null>(null);
  const [dialogo, setDialogo] = useState<{ tipo: TipoExcepcion; excepcion: Excepcion | null } | null>(null);
  const sinGuardar = useRef(false);
  const haySinGuardar = useCallback(() => sinGuardar.current, []);
  const marcar = useCallback((sucio: boolean) => {
    sinGuardar.current = sucio;
  }, []);

  /** Tras guardar: aviso y la tarjeta de citas fuera de la disponibilidad (la API no vuelve a darlas). */
  const alGuardar = (citas: CitaAfectada[], guardado: string) => {
    setAfectadas(citas.length > 0 ? { citas, guardado } : null);
    if (citas.length === 0) aviso.exito(guardado);
    else aviso.advertencia(`${guardado}. ${textoCitasFuera(citas.length)}`);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-bold text-ink">{nombre}</h2>
          <p className="text-body text-muted">
            {puede("empleados", "ver") ? (
              <>
                <Link to="../miembros" className="hover:underline">
                  Equipo
                </Link>{" "}
                / {nombre} / Disponibilidad
              </>
            ) : (
              // Sin Equipo en el menú: llegó desde Mi perfil.
              <>
                <Link to="../../mi-perfil" className="hover:underline">
                  Mi perfil
                </Link>{" "}
                / Mi disponibilidad
              </>
            )}
          </p>
        </div>
      </div>
      {!activo && (
        <Alert tono="advertencia" className="mb-4">
          Este miembro está inactivo: no tiene disponibilidad. Reactívalo para cambiarla.
        </Alert>
      )}
      <div className="grid grid-cols-[1fr_380px] items-start gap-5">
        <HorarioSemanal
          idEmpleado={idEmpleado}
          disponibilidad={disponibilidad}
          sedes={sedes}
          puedeEditar={puedeEditar}
          onSucio={marcar}
          onGuardado={alGuardar}
        />
        <div className="flex flex-col gap-5">
          <Excepciones
            idEmpleado={idEmpleado}
            excepciones={disponibilidad.excepciones}
            sedes={sedes}
            puedeEditar={puedeEditar}
            onNueva={(tipo) => setDialogo({ tipo, excepcion: null })}
            onEditar={(excepcion) => setDialogo({ tipo: excepcion.tipo, excepcion })}
            onEliminada={alGuardar}
          />
          {afectadas && <CitasFuera afectadas={afectadas} />}
          <DisponibilidadDelDia idEmpleado={idEmpleado} excepciones={disponibilidad.excepciones} />
        </div>
      </div>
      {dialogo && (
        <ExcepcionDialog
          idEmpleado={idEmpleado}
          nombreEmpleado={nombre}
          tipoInicial={dialogo.tipo}
          excepcion={dialogo.excepcion}
          sedes={sedes}
          onCerrar={() => setDialogo(null)}
          onGuardada={(citas, guardado) => {
            setDialogo(null);
            alGuardar(citas, guardado);
          }}
        />
      )}
      <AvisoCambiosSinGuardar haySinGuardar={haySinGuardar} />
    </div>
  );
}

function HorarioSemanal({
  idEmpleado,
  disponibilidad,
  sedes,
  puedeEditar,
  onSucio,
  onGuardado,
}: {
  idEmpleado: number;
  disponibilidad: Disponibilidad;
  sedes: SedeHorario[];
  puedeEditar: boolean;
  onSucio: (sucio: boolean) => void;
  onGuardado: (citas: CitaAfectada[], guardado: string) => void;
}) {
  const guardar = useGuardarHorarioSemanal(idEmpleado);
  const guardada = semanaProfesionalDesdeApi(disponibilidad.horario_semanal);
  const [semana, setSemana] = useState<SemanaProfesional>(guardada);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const sucio = !semanasProfesionalIguales(semana, guardada);
  const principal = sedes.find((s) => s.es_principal) ?? sedes[0];
  const vacia = semana.every((r) => r.length === 0);

  useEffect(() => {
    onSucio(sucio);
  }, [sucio, onSucio]);

  const guardarSemana = () => {
    const delCliente = erroresSemanaProfesional(semana);
    setErrores(delCliente);
    if (Object.keys(delCliente).length > 0) return setMensaje("Corrige los rangos marcados.");
    setMensaje(null);
    const { horarios, posiciones } = semanaProfesionalAApi(semana);
    guardar.mutate(horarios, {
      onSuccess: ({ citas_afectadas }) => {
        onSucio(false);
        onGuardado(
          citas_afectadas,
          horarios.length === 0 ? "Ahora sigue el horario de la sede" : "Horario guardado",
        );
      },
      onError: (e) => {
        // horarios.N del 422 -> la ficha del día y rango que se envió en la posición N.
        setErrores(
          Object.fromEntries(
            Object.entries(e.errors).flatMap(([clave, texto]) => {
              const p = posiciones[Number(clave.split(".")[1])];
              return p ? [[`${p.dia}-${p.indice}`, texto]] : [];
            }),
          ),
        );
        setMensaje(e.message);
      },
    });
  };

  return (
    <Card className="p-5">
      <h3 className="text-card font-semibold text-ink">Horario semanal</h3>
      <p className="mt-2 mb-3 rounded-control bg-surface px-3 py-2 text-label text-muted">
        {disponibilidad.sigue_horario_sucursal
          ? "Sin horario propio: el profesional sigue el horario de la sede. "
          : "La disponibilidad real es este horario recortado por el de la sede. "}
        Los rangos de un mismo día no pueden cruzarse, aunque sean de sedes distintas.
      </p>
      {vacia && puedeEditar && principal && principal.horarios.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="mb-2"
          onClick={() => setSemana(semanaDesdeSede(principal.horarios, principal.id_sucursal))}
        >
          Partir del horario de {principal.nombre}
        </Button>
      )}
      <EditorHorarioProfesional
        value={semana}
        onChange={setSemana}
        sedes={sedes}
        errores={errores}
        disabled={!puedeEditar || guardar.isPending}
        referencia={horarioDeSedes(sedes)}
        soloLectura={!puedeEditar}
      />
      {mensaje && (
        <Alert tono="error" className="mt-3">
          {mensaje}
        </Alert>
      )}
      {puedeEditar && (
        <div className="mt-4 flex justify-end gap-2">
          {sucio && (
            <Button variant="secondary" onClick={() => setSemana(guardada)} disabled={guardar.isPending}>
              Descartar
            </Button>
          )}
          <Button onClick={guardarSemana} disabled={!sucio} cargando={guardar.isPending}>
            Guardar semana
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Por día: "Sede Centro: 08:00–12:00 · 14:00–18:00", o "Sede cerrada". */
function horarioDeSedes(sedes: SedeHorario[]): string[] {
  const semanas = sedes.map((s) => ({ nombre: s.nombre, semana: semanaDesdeApi(s.horarios) }));
  return Array.from({ length: 7 }, (_, dia) => {
    const abiertas = semanas.filter((s) => s.semana[dia]!.length > 0);
    if (abiertas.length === 0) return sedes.length > 1 ? "Sedes cerradas" : "Sede cerrada";
    return abiertas.map((s) => `${s.nombre}: ${textoRangos(s.semana[dia]!)}`).join(" · ");
  });
}

/** "20 – 27 sep · días completos", "30 sep · 14:00–18:00", "dom 5 oct · 08:00–12:00 · Sede Norte". */
function textoExcepcion(e: Excepcion, sedes: SedeHorario[]) {
  const dias =
    e.fecha_fin && e.fecha_fin !== e.fecha_especifica
      ? `${fechaCorta(e.fecha_especifica)} – ${fechaCorta(e.fecha_fin)}`
      : fechaCorta(e.fecha_especifica);
  const horas = e.hora_inicio && e.hora_fin ? `${hora(e.hora_inicio)}–${hora(e.hora_fin)}` : "días completos";
  const sede = e.id_sucursal ? sedes.find((s) => s.id_sucursal === e.id_sucursal)?.nombre : null;
  return [dias, horas, sede].filter(Boolean).join(" · ");
}

function Excepciones({
  idEmpleado,
  excepciones,
  sedes,
  puedeEditar,
  onNueva,
  onEditar,
  onEliminada,
}: {
  idEmpleado: number;
  excepciones: Excepcion[];
  sedes: SedeHorario[];
  puedeEditar: boolean;
  onNueva: (tipo: TipoExcepcion) => void;
  onEditar: (e: Excepcion) => void;
  onEliminada: (citas: CitaAfectada[], guardado: string) => void;
}) {
  const eliminar = useEliminarExcepcion(idEmpleado);
  const [porEliminar, setPorEliminar] = useState<Excepcion | null>(null);
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-card font-semibold text-ink">Excepciones</h3>
      {excepciones.length === 0 ? (
        <p className="mb-3 text-body text-muted">Sin bloqueos, vacaciones ni eventos desde hoy.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {excepciones.map((e) => {
            const Icono = ICONO[e.tipo];
            return (
              <li key={e.id_disponibilidad} className="flex items-center gap-3 rounded-card border p-3">
                <Icono className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">
                    {e.motivo ?? NOMBRE_TIPO[e.tipo]}
                  </p>
                  <p className="truncate text-label text-muted">{textoExcepcion(e, sedes)}</p>
                </div>
                <Badge tono={TONO[e.tipo]}>{NOMBRE_TIPO[e.tipo]}</Badge>
                {puedeEditar && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Acciones de ${e.motivo ?? NOMBRE_TIPO[e.tipo].toLowerCase()}`}
                      >
                        <MoreHorizontal className="text-muted" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEditar(e)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-danger" onSelect={() => setPorEliminar(e)}>
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(NOMBRE_TIPO) as TipoExcepcion[]).map((tipo) => (
            <Button key={tipo} variant="secondary" size="sm" onClick={() => onNueva(tipo)}>
              + {NOMBRE_TIPO[tipo]}
            </Button>
          ))}
        </div>
      )}
      <ConfirmDialog
        abierto={porEliminar !== null}
        onAbiertoChange={(abierto) => {
          if (!abierto) {
            setPorEliminar(null);
            eliminar.reset();
          }
        }}
        titulo={`¿Eliminar ${porEliminar ? NOMBRE_TIPO[porEliminar.tipo].toLowerCase() : ""}?`}
        descripcion={
          porEliminar?.tipo === "evento_especial"
            ? "Quitar un evento especial puede dejar citas fuera de la disponibilidad: te mostraremos cuáles."
            : "El profesional vuelve a estar disponible en esas fechas."
        }
        confirmar="Eliminar"
        peligro
        cargando={eliminar.isPending}
        onConfirmar={() =>
          porEliminar &&
          eliminar.mutate(porEliminar.id_disponibilidad, {
            onSuccess: ({ citas_afectadas }) => {
              setPorEliminar(null);
              onEliminada(citas_afectadas, ELIMINADA[porEliminar.tipo]);
            },
          })
        }
      >
        {eliminar.error && <Alert tono="error">{eliminar.error.message}</Alert>}
      </ConfirmDialog>
    </Card>
  );
}

/** Aviso que queda en la pantalla con las citas fuera de la disponibilidad tras el último cambio. */
function CitasFuera({ afectadas: { citas, guardado } }: { afectadas: Afectadas }) {
  const mostrarCitasAfectadas = useUi((s) => s.mostrarCitasAfectadas);
  return (
    <div role="status" className="rounded-card border border-warning/40 bg-warning-soft p-4 text-warning-ink">
      <p className="flex items-center gap-2 text-body font-semibold">
        <TriangleAlert className="size-4" aria-hidden /> {textoCitasFuera(citas.length)}
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-body">
        {citas.slice(0, 4).map((c) => (
          <li key={c.id_cita}>
            {c.mascota.nombre} · {fechaCorta(c.fecha)}, {hora(c.hora_inicio)} · {c.cliente.nombre}{" "}
            {c.cliente.apellido}
          </li>
        ))}
        {citas.length > 4 && <li>y {citas.length - 4} más</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => mostrarCitasAfectadas(citas, guardado)}>
          Ver detalle y copiar
        </Button>
        <Tooltip texto="Reasignar y reprogramar llegan con la agenda (P4)">
          <span>
            <Button size="sm" variant="secondary" disabled>
              Reasignar
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

function DisponibilidadDelDia({ idEmpleado, excepciones }: { idEmpleado: number; excepciones: Excepcion[] }) {
  const [fecha, setFecha] = useState(hoyISO());
  const efectiva = useDisponibilidadEfectiva(idEmpleado, fecha);
  const delDia = excepciones.filter(
    (e) =>
      e.tipo !== "evento_especial" &&
      e.fecha_especifica <= fecha &&
      (e.fecha_fin ?? e.fecha_especifica) >= fecha,
  );
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-card font-semibold text-ink">Disponibilidad efectiva</h3>
        <Input
          type="date"
          aria-label="Día a consultar"
          className="h-9 w-40"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      {valida && <p className="-mt-1 mb-3 text-label text-muted">{fechaLargaTitulo(fecha)}</p>}
      {!efectiva.data ? (
        efectiva.isError ? (
          <p className="text-body text-danger">{efectiva.error.message}</p>
        ) : (
          <Cargando lineas={2} className="p-0" />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {efectiva.data.sucursales.map((s) => (
            <li key={s.id_sucursal}>
              {efectiva.data.sucursales.length > 1 && (
                <p className="mb-1 text-label text-muted">{s.nombre}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {s.rangos.length === 0 ? (
                  <span className="text-label text-muted">No atiende este día</span>
                ) : (
                  s.rangos.map((r) => (
                    <span
                      key={r.hora_inicio}
                      className="rounded-control bg-primary-soft px-2.5 py-1 text-label font-semibold text-primary-dark tabular-nums"
                    >
                      {hora(r.hora_inicio)}–{hora(r.hora_fin)}
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {delDia.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {delDia.map((e) => (
            <span
              key={e.id_disponibilidad}
              className="rounded-control bg-track px-2.5 py-1 text-label text-muted"
            >
              {e.hora_inicio && e.hora_fin
                ? `${hora(e.hora_inicio)}–${hora(e.hora_fin)} bloqueado`
                : `${NOMBRE_TIPO[e.tipo]}: todo el día`}
              {e.motivo ? `: ${e.motivo.toLowerCase()}` : ""}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-label text-subtle">No descuenta las citas ya agendadas.</p>
    </Card>
  );
}
