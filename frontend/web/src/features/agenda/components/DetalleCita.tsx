import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CitaPanelDetalle } from "@/api/citas";
import { Avatar } from "@/components/common/Avatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EstadoCitaBadge } from "@/components/common/EstadoCitaBadge";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { aviso } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { encabezadoDia } from "@/lib/agenda";
import { dinero, fechaHora, hora, hoyISO } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { accionesDe, autorCambio, textoOrigen, tituloCambio } from "../acciones";
import { mensajeDeError } from "../errores";
import { useAhora } from "../hooks/useAgenda";
import { useActualizarCita, useCambiarEstado, useCita, useHistorialCita } from "../hooks/useCita";
import {
  nombreCompleto,
  nombreProfesional,
  ORIGEN,
  textoCancelacion,
  textoEdad,
  textoMotivoFuera,
  textoPeso,
  textoPlazoLargo,
} from "../textos";

const ESPECIE: Record<string, string> = { perro: "Perro", gato: "Gato", conejo: "Conejo", ave: "Ave" };

/**
 * B4 · Detalle de la cita (panel lateral): estado y plazo para confirmar, mascota (con
 * alergias), cliente con su cumplimiento en este negocio, datos de la cita, notas internas e
 * historial. Las acciones dependen del estado, la hora y el rol; las que piden datos abren
 * sus diálogos (AccionesCita).
 */
export function DetalleCita({ idCita, onCerrar }: { idCita: number; onCerrar: () => void }) {
  const negocio = useNegocioActivo();
  const cita = useCita(negocio.id_negocio, idCita);
  return (
    <Sheet open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-[480px]" aria-describedby={undefined}>
        {cita.data ? (
          <Contenido key={cita.data.id_cita} cita={cita.data} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Cita #{idCita}</SheetTitle>
            </SheetHeader>
            <SheetBody>
              {cita.isError ? (
                <ErrorConsulta error={cita.error} reintentar={() => void cita.refetch()} />
              ) : (
                <div className="flex flex-col gap-3" aria-busy>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-40" />
                </div>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Contenido({ cita }: { cita: CitaPanelDetalle }) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const ahora = useAhora();
  const abrirAccion = useUi((s) => s.abrirAccionCita);
  const estado = useCambiarEstado(negocio.id_negocio);
  const [confirmarNoAsistio, setConfirmarNoAsistio] = useState(false);
  const acciones = accionesDe(
    cita,
    { editar: puede("citas", "editar"), cancelar: puede("citas", "cancelar") },
    ahora,
  );
  const hoy = hoyISO(ahora);

  const cambiarEstado = (nuevo: "confirmada" | "en_curso" | "no_asistio", mensaje: string) =>
    estado.mutate(
      { idCita: cita.id_cita, estado: nuevo },
      {
        onSuccess: () => {
          aviso.exito(mensaje);
          setConfirmarNoAsistio(false);
        },
        onError: (e) => aviso.advertencia(e.message),
      },
    );

  return (
    <>
      <SheetHeader>
        <SheetTitle>Cita #{cita.id_cita}</SheetTitle>
        <SheetDescription>
          {encabezadoDia(cita.fecha)} · {hora(cita.hora_inicio)} – {hora(cita.hora_fin)}
        </SheetDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <EstadoCitaBadge estado={cita.estado} cancelacion={cita.cancelacion} />
          <Badge tono="info">{textoOrigen(cita.origen)}</Badge>
          {cita.prioridad !== "normal" && <Badge tono="danger">Prioridad {cita.prioridad}</Badge>}
        </div>
      </SheetHeader>

      <SheetBody className="flex flex-col gap-4">
        {cita.estado === "pendiente" && cita.confirmar_antes_de && (
          <Alert tono="advertencia">
            Confírmala {textoPlazoLargo(cita.confirmar_antes_de, hoy)} o se cancelará sola.
          </Alert>
        )}
        {cita.fuera_de_disponibilidad && (
          <Alert tono="advertencia" className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{textoMotivoFuera(cita)}. Reprográmala o reasígnala y avísale al cliente.</span>
          </Alert>
        )}
        {textoCancelacion(cita) && <Alert tono="error">{textoCancelacion(cita)}</Alert>}

        <Mascota cita={cita} />
        <Cliente cita={cita} />
        <Datos
          cita={cita}
          puedeReasignar={acciones.reasignar}
          onReasignar={() => abrirAccion("reasignar", cita.id_cita)}
        />
        {cita.notas_cliente && (
          <div>
            <p className="mb-1 text-label font-semibold text-muted">Nota del cliente</p>
            <p className="text-body text-ink">{cita.notas_cliente}</p>
          </div>
        )}
        <NotasInternas cita={cita} editable={puede("citas", "editar")} />
        <Historial cita={cita} hoy={hoy} />
      </SheetBody>

      <SheetFooter className="flex-wrap">
        {acciones.confirmar && (
          <Button
            className="flex-1"
            cargando={estado.isPending}
            onClick={() => cambiarEstado("confirmada", "Cita confirmada")}
          >
            Confirmar
          </Button>
        )}
        {acciones.completar && (
          <Button className="flex-1" onClick={() => abrirAccion("completar", cita.id_cita)}>
            Completar
          </Button>
        )}
        {acciones.iniciar && (
          <Button
            variant={acciones.completar ? "secondary" : "primary"}
            cargando={estado.isPending}
            onClick={() => cambiarEstado("en_curso", "Cita en curso")}
          >
            Iniciar atención
          </Button>
        )}
        {acciones.llegoTarde && (
          <Button cargando={estado.isPending} onClick={() => cambiarEstado("en_curso", "Cita en curso")}>
            Llegó tarde: pasar a en curso
          </Button>
        )}
        {acciones.noAsistio && (
          <Button variant="secondary" onClick={() => setConfirmarNoAsistio(true)}>
            No asistió
          </Button>
        )}
        {acciones.reprogramar && (
          <Button variant="secondary" onClick={() => abrirAccion("reprogramar", cita.id_cita)}>
            Reprogramar
          </Button>
        )}
        {(acciones.cancelar || acciones.rechazar) && (
          <Button
            variant="danger-outline"
            onClick={() => abrirAccion(acciones.rechazar ? "rechazar" : "cancelar", cita.id_cita)}
          >
            {acciones.rechazar ? "Rechazar" : "Cancelar"}
          </Button>
        )}
      </SheetFooter>

      <ConfirmDialog
        abierto={confirmarNoAsistio}
        onAbiertoChange={setConfirmarNoAsistio}
        titulo="¿Marcar como no asistió?"
        descripcion="Cuenta en el historial del cliente con este negocio. Si llega tarde hoy, podrás pasarla a “En curso”."
        confirmar="Marcar como no asistió"
        cargando={estado.isPending}
        onConfirmar={() => cambiarEstado("no_asistio", "Inasistencia registrada")}
      />
    </>
  );
}

function Mascota({ cita }: { cita: CitaPanelDetalle }) {
  const m = cita.mascota;
  const detalle = [
    ESPECIE[m.especie] ?? m.especie,
    m.raza,
    textoEdad(m.edad_meses),
    textoPeso(m.peso),
  ].filter(Boolean);
  return (
    <section aria-label="Mascota" className="rounded-card border p-4">
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-done-soft text-card font-bold text-done"
          aria-hidden
        >
          {m.nombre.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-card font-semibold text-ink">{m.nombre}</p>
          <p className="text-label text-muted">{detalle.join(" · ")}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {m.tiene_alergias && (
          <Badge tono="danger">
            <TriangleAlert className="size-3" aria-hidden /> Alergia: {m.alergias_detalle ?? "sin detalle"}
          </Badge>
        )}
        {m.fallecido && <Badge>Fallecida</Badge>}
      </div>
      <Tooltip texto="La ficha médica llega con Clientes y salud (P5)">
        <span className="mt-2 inline-block text-label font-semibold text-subtle">Ver ficha médica →</span>
      </Tooltip>
    </section>
  );
}

function Cliente({ cita }: { cita: CitaPanelDetalle }) {
  const c = cita.cliente;
  const h = c.historial_cumplimiento;
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  return (
    <section aria-label="Cliente" className="rounded-card border p-4">
      <div className="flex items-center gap-3">
        <Avatar nombre={nombreCompleto(c)} tono="suave" tamano="lg" />
        <div className="min-w-0">
          <p className="text-card font-semibold text-ink">{nombreCompleto(c)}</p>
          <p className="truncate text-label text-muted">
            {c.telefono && (
              <a href={`tel:${c.telefono}`} className="hover:text-primary hover:underline">
                {c.telefono}
              </a>
            )}
            {c.telefono && c.email && " · "}
            {c.email && (
              <a href={`mailto:${c.email}`} className="hover:text-primary hover:underline">
                {c.email}
              </a>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Cumplimiento con este negocio">
        {c.email === null ? (
          <Tooltip texto="Registrado sin correo: no recibe correos ni recordatorios y no puede entrar a la app">
            <span>
              <Badge>Sin cuenta</Badge>
            </span>
          </Tooltip>
        ) : (
          <Badge tono="info">{c.usa_app ? "Usa la app" : "Sin app"}</Badge>
        )}
        <Badge tono="primary">{plural(h.completadas, "completada", "completadas")}</Badge>
        <Badge tono={h.inasistencias > 0 ? "warning" : "neutral"}>
          {plural(h.inasistencias, "inasistencia", "inasistencias")}
        </Badge>
        <Badge tono={h.cancelaciones_tardias > 0 ? "warning" : "neutral"}>
          {plural(h.cancelaciones_tardias, "cancelación tardía", "cancelaciones tardías")}
        </Badge>
      </div>
    </section>
  );
}

function Datos({
  cita,
  puedeReasignar,
  onReasignar,
}: {
  cita: CitaPanelDetalle;
  puedeReasignar: boolean;
  onReasignar: () => void;
}) {
  const filas: [string, ReactNode][] = [
    ["Servicio", `${cita.servicio.nombre} · ${cita.servicio.duracion_minutos} min`],
    ["Sede", cita.sucursal?.nombre ?? "Sin sede"],
    [
      "Profesional",
      <span key="p" className="flex items-center justify-end gap-2">
        {nombreProfesional(cita)}
        {puedeReasignar && (
          <Button variant="link" size="sm" onClick={onReasignar}>
            Reasignar
          </Button>
        )}
      </span>,
    ],
    ["Precio estimado", dinero(cita.precio_estimado)],
    ...(cita.precio_final !== null
      ? ([["Precio final", dinero(cita.precio_final)]] as [string, string][])
      : []),
    ["Origen", ORIGEN[cita.origen]],
  ];
  return (
    <dl className="rounded-card border px-4 py-2">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
          <dt className="text-body text-muted">{etiqueta}</dt>
          <dd className="text-right text-body font-semibold text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function NotasInternas({ cita, editable }: { cita: CitaPanelDetalle; editable: boolean }) {
  const negocio = useNegocioActivo();
  const guardar = useActualizarCita(negocio.id_negocio);
  const original = cita.notas_internas ?? "";
  const [texto, setTexto] = useState(original);
  const cambiado = texto.trim() !== original.trim();
  const error = mensajeDeError(guardar.error);
  return (
    <div>
      <label htmlFor="notas-internas" className="mb-1.5 block text-label font-semibold text-muted">
        Notas internas (no las ve el cliente)
      </label>
      <Textarea
        id="notas-internas"
        value={texto}
        maxLength={2000}
        disabled={!editable}
        placeholder={editable ? "Ej.: traer el carnet físico" : "Sin notas"}
        onChange={(e) => setTexto(e.target.value)}
      />
      {error && (
        <Alert tono="error" className="mt-2">
          {error}
        </Alert>
      )}
      {editable && cambiado && (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTexto(original)}>
            Descartar
          </Button>
          <Button
            size="sm"
            cargando={guardar.isPending}
            onClick={() =>
              guardar.mutate(
                { idCita: cita.id_cita, notas_internas: texto.trim() || null },
                { onSuccess: () => aviso.exito("Notas guardadas") },
              )
            }
          >
            Guardar notas
          </Button>
        </div>
      )}
    </div>
  );
}

function Historial({ cita, hoy }: { cita: CitaPanelDetalle; hoy: string }) {
  const negocio = useNegocioActivo();
  const historial = useHistorialCita(negocio.id_negocio, cita.id_cita);
  return (
    <section aria-label="Historial de la cita">
      <h3 className="mb-2 text-label font-semibold text-muted">Historial de la cita</h3>
      {!historial.data ? (
        historial.isError ? (
          <p className="text-body text-danger">{historial.error.message}</p>
        ) : (
          <Skeleton className="h-16" />
        )
      ) : (
        <ol className="flex flex-col gap-3">
          {historial.data.map((c, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>
                <span className="block text-body font-semibold text-ink">{tituloCambio(c, cita.origen)}</span>
                {c.motivo && c.motivo !== "Cita creada" && (
                  <span className="block text-label text-ink">{c.motivo}</span>
                )}
                <span className="block text-label text-muted">
                  {fechaHora(c.fecha_cambio)} · {autorCambio(c)}
                </span>
              </span>
            </li>
          ))}
          {cita.estado === "pendiente" && cita.confirmar_antes_de && (
            <li className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" aria-hidden />
              <span>
                <span className="block text-body font-semibold text-ink">
                  Plazo para confirmar:{" "}
                  {textoPlazoLargo(cita.confirmar_antes_de, hoy).replace(/^antes de(l| las) /, "")}
                </span>
                <span className="block text-label text-muted">Calculado automáticamente</span>
              </span>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
