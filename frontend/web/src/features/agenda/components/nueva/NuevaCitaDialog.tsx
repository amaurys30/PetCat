import { CalendarDays, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Cita } from "@/api/citas";
import type { ClienteRegistrado } from "@/api/clientes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { aviso } from "@/components/ui/toaster";
import { AgregarMascotaDialog } from "@/features/clientes/components/AgregarMascotaDialog";
import { RegistrarClienteDialog } from "@/features/clientes/components/RegistrarClienteDialog";
import { useClienteDetalle } from "@/features/clientes/hooks/useClientes";
import { useSedes } from "@/features/equipo/hooks/useDisponibilidad";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { useCatalogoServicios } from "@/features/servicios/hooks/useServicios";
import { encabezadoDia, sumarDias } from "@/lib/agenda";
import { dinero, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { abiertosDelDia } from "../../calculos";
import { mensajeDeError } from "../../errores";
import { useProfesionales } from "../../hooks/useAgenda";
import { useCrearCita, useHorariosLibres } from "../../hooks/useCita";
import type { ClienteElegido } from "../../nuevaCita";
import { nombreCompleto } from "../../textos";
import { BuscarCliente } from "./BuscarCliente";

const CUALQUIERA = "cualquiera";
const ORIGENES = [
  { valor: "presencial", texto: "Presencial" },
  { valor: "telefono", texto: "Teléfono" },
  { valor: "whatsapp", texto: "WhatsApp" },
] as const;
type Origen = (typeof ORIGENES)[number]["valor"];

/** Lo que se sabe al abrir: un hueco del calendario deja la fecha, la hora y el profesional. */
export interface InicioNuevaCita {
  fecha?: string;
  hora?: string;
  idEmpleado?: number;
}

const Paso = ({ n, titulo }: { n: number; titulo: string }) => (
  <p className="mb-2 text-label font-semibold tracking-wide text-muted uppercase">
    {n} · {titulo}
  </p>
);

/**
 * B5 · Nueva cita desde el panel: cliente (o registrarlo sin app, C3), mascota, servicio y
 * sede, fecha y uno de los horarios libres del panel (sin antelación mínima y sin las horas
 * en que la mascota ya tiene otra cita), origen y notas internas. Queda confirmada. El 409
 * (otro tomó el horario) recarga los horarios; el 403 del plan abre el diálogo de Pro.
 */
export function NuevaCitaDialog({
  inicio,
  onCerrar,
  onCreada,
}: {
  inicio: InicioNuevaCita;
  onCerrar: () => void;
  onCreada: (cita: Cita) => void;
}) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const hoy = hoyISO();
  const { sedes } = useSedes();
  const catalogo = useCatalogoServicios(negocio.id_negocio);
  const profesionales = useProfesionales(negocio.id_negocio);
  const crear = useCrearCita(negocio.id_negocio);

  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [registrando, setRegistrando] = useState<{ email?: string; telefono?: string } | null>(null);
  const [agregandoMascota, setAgregandoMascota] = useState(false);
  const [idMascota, setIdMascota] = useState<number | null>(null);
  const [idServicio, setIdServicio] = useState<number | null>(null);
  const [idSucursal, setIdSucursal] = useState<number | null>(null);
  const [fecha, setFecha] = useState(inicio.fecha && inicio.fecha >= hoy ? inicio.fecha : hoy);
  const [empleado, setEmpleado] = useState(inicio.idEmpleado ? String(inicio.idEmpleado) : CUALQUIERA);
  const [horaElegida, setHora] = useState<string | null>(null);
  // La hora del hueco del calendario cuenta como elegida mientras esté libre y no se cambie nada.
  const [horaDelHueco, setHoraDelHueco] = useState(inicio.hora ?? null);
  const [origen, setOrigen] = useState<Origen>("telefono");
  const [notas, setNotas] = useState("");
  const [intentado, setIntentado] = useState(false);

  // La búsqueda por nombre no trae las mascotas: salen del detalle del cliente.
  const detalle = useClienteDetalle(
    negocio.id_negocio,
    cliente && !cliente.mascotas ? cliente.id_usuario : null,
  );
  const mascotas =
    cliente?.mascotas ??
    detalle.data?.mascotas
      .filter((m) => !m.fallecido)
      .map((m) => ({ id_mascota: m.id_mascota, nombre: m.nombre, especie: m.especie }));

  const servicios = useMemo(
    () => (catalogo.data ?? []).filter((s) => s.activo && s.requiere_cita && !s.sin_empleados),
    [catalogo.data],
  );
  const servicio = servicios.find((s) => s.id_servicio === idServicio) ?? null;
  const sede =
    sedes?.find((s) => s.id_sucursal === idSucursal) ?? (sedes?.length === 1 ? sedes[0] : undefined);
  const quienes = (profesionales.data ?? []).filter((p) =>
    p.servicios.some((s) => s.id_servicio === idServicio),
  );
  const idEmpleado =
    empleado !== CUALQUIERA && quienes.some((p) => String(p.id_empleado) === empleado)
      ? Number(empleado)
      : undefined;

  const proximos = useMemo(() => {
    const dias: string[] = [];
    for (let i = 0; i < 21 && dias.length < 4; i++) {
      const d = sumarDias(hoy, i);
      if (!sede || abiertosDelDia([sede], d).length > 0) dias.push(d);
    }
    return dias;
  }, [hoy, sede]);

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoy;
  const horarios = useHorariosLibres(
    negocio.id_negocio,
    servicio && sede && fechaValida
      ? {
          id_servicio: servicio.id_servicio,
          id_sucursal: sede.id_sucursal,
          fecha,
          id_empleado: idEmpleado,
          id_mascota: idMascota ?? undefined,
        }
      : null,
  );
  const libres = horarios.data?.horarios;

  const hora =
    horaElegida ??
    (horaDelHueco && libres?.some((h) => h.hora_inicio === horaDelHueco) ? horaDelHueco : null);

  const limpiarHora = () => {
    setHora(null);
    setHoraDelHueco(null);
    crear.reset();
  };
  const elegirCliente = (c: ClienteElegido | null) => {
    setCliente(c);
    setIdMascota(c?.mascotas?.length === 1 ? c.mascotas[0]!.id_mascota : null);
    limpiarHora();
  };
  const registrado = ({ cliente: nuevo, mascota, sin_cuenta }: ClienteRegistrado) => {
    setRegistrando(null);
    setCliente({
      ...nuevo,
      usa_app: false,
      mascotas: [{ id_mascota: mascota.id_mascota, nombre: mascota.nombre, especie: mascota.especie }],
    });
    setIdMascota(mascota.id_mascota);
    limpiarHora();
    aviso.exito(
      sin_cuenta
        ? `${nuevo.nombre} quedó registrado sin cuenta: no recibirá correos ni recordatorios.`
        : `${nuevo.nombre} quedó registrado. Le enviamos el correo de bienvenida.`,
    );
  };

  const faltante = !cliente
    ? "Elige o registra al cliente"
    : !idMascota
      ? "Elige la mascota"
      : !servicio
        ? "Elige el servicio"
        : !sede
          ? "Elige la sede"
          : !hora
            ? "Elige un horario libre"
            : null;
  const error = mensajeDeError(crear.error);

  const enviar = () => {
    setIntentado(true);
    if (faltante || !cliente || !idMascota || !servicio || !sede || !hora) return;
    crear.mutate(
      {
        id_usuario: cliente.id_usuario,
        id_mascota: idMascota,
        id_servicio: servicio.id_servicio,
        id_sucursal: sede.id_sucursal,
        fecha,
        hora_inicio: hora,
        id_empleado: idEmpleado,
        origen,
        ...(notas.trim() && { notas_internas: notas.trim() }),
      },
      {
        onSuccess: onCreada,
        onError: (e) => {
          if (e.status === 409) {
            setHora(null);
            setHoraDelHueco(null);
            void horarios.refetch();
          }
        },
      },
    );
  };

  const mascotaElegida = mascotas?.find((m) => m.id_mascota === idMascota);
  const profesionalElegido = quienes.find((p) => p.id_empleado === idEmpleado);
  const resumen = [
    mascotaElegida?.nombre,
    servicio?.nombre,
    hora && fechaValida ? `${encabezadoDia(fecha)}, ${hora}` : null,
    profesionalElegido ? nombreCompleto(profesionalElegido) : hora ? "asignación automática" : null,
  ].filter(Boolean);

  return (
    <>
      <Dialog open={!registrando && !agregandoMascota} onOpenChange={(abierto) => !abierto && onCerrar()}>
        <DialogContent className="max-h-[94vh] max-w-[920px] overflow-y-auto">
          <DialogTitle>Nueva cita</DialogTitle>
          <div className="mt-4 grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-5">
              <section>
                <Paso n={1} titulo="Cliente" />
                <BuscarCliente
                  puedeNombre={puede("clientes", "ver")}
                  elegido={cliente}
                  onElegir={elegirCliente}
                  onRegistrar={setRegistrando}
                />
              </section>

              <section>
                <Paso n={2} titulo="Mascota" />
                {!cliente ? (
                  <p className="text-body text-subtle">Primero elige al cliente.</p>
                ) : !mascotas ? (
                  <Skeleton className="h-8 w-40" />
                ) : (
                  <div role="radiogroup" aria-label="Mascota" className="flex flex-wrap gap-2">
                    {mascotas.map((m) => (
                      <button
                        key={m.id_mascota}
                        type="button"
                        role="radio"
                        aria-checked={idMascota === m.id_mascota}
                        onClick={() => {
                          setIdMascota(m.id_mascota);
                          limpiarHora();
                        }}
                        className={cn(
                          "h-8 rounded-control border px-3 text-body font-medium",
                          idMascota === m.id_mascota
                            ? "border-primary bg-primary text-white"
                            : "bg-white text-ink hover:bg-surface",
                        )}
                      >
                        {m.nombre}
                      </button>
                    ))}
                    <Button variant="link" size="sm" onClick={() => setAgregandoMascota(true)}>
                      <Plus /> Nueva mascota
                    </Button>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <Paso n={3} titulo="Servicio y sede" />
                <Select
                  value={idServicio ? String(idServicio) : undefined}
                  onValueChange={(v) => {
                    setIdServicio(Number(v));
                    limpiarHora();
                  }}
                >
                  <SelectTrigger aria-label="Servicio">
                    <SelectValue
                      placeholder={catalogo.isPending ? "Cargando servicios…" : "Elige el servicio"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {servicios.map((s) => (
                      <SelectItem key={s.id_servicio} value={String(s.id_servicio)}>
                        {s.nombre} · {s.duracion_minutos} min · {dinero(s.precio_actual)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(sedes?.length ?? 0) > 1 ? (
                  <Select
                    value={sede ? String(sede.id_sucursal) : undefined}
                    onValueChange={(v) => {
                      setIdSucursal(Number(v));
                      limpiarHora();
                    }}
                  >
                    <SelectTrigger aria-label="Sede">
                      <SelectValue placeholder="Elige la sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {sedes!.map((s) => (
                        <SelectItem key={s.id_sucursal} value={String(s.id_sucursal)}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  sede && <p className="text-body text-muted">Sede: {sede.nombre}</p>
                )}
              </section>

              <section>
                <Label
                  id="origen-cita"
                  className="mb-2 block text-label font-semibold tracking-wide uppercase"
                >
                  Origen
                </Label>
                <div role="radiogroup" aria-labelledby="origen-cita" className="flex gap-2">
                  {ORIGENES.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={origen === o.valor}
                      onClick={() => setOrigen(o.valor)}
                      className={cn(
                        "h-8 rounded-control border px-3 text-body font-medium",
                        origen === o.valor
                          ? "border-primary bg-primary text-white"
                          : "bg-white text-ink hover:bg-surface",
                      )}
                    >
                      {o.texto}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-3">
                <Paso n={4} titulo="Fecha y hora" />
                <div role="radiogroup" aria-label="Fecha" className="flex flex-wrap items-center gap-2">
                  {proximos.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={fecha === d}
                      onClick={() => {
                        setFecha(d);
                        limpiarHora();
                      }}
                      className={cn(
                        "h-8 rounded-control border px-3 text-body font-medium",
                        fecha === d
                          ? "border-primary bg-primary text-white"
                          : "bg-white text-ink hover:bg-surface",
                      )}
                    >
                      {encabezadoDia(d)}
                    </button>
                  ))}
                  <label className="relative flex items-center">
                    <span className="sr-only">Otra fecha</span>
                    <CalendarDays
                      className="pointer-events-none absolute left-2.5 size-4 text-muted"
                      aria-hidden
                    />
                    <Input
                      type="date"
                      min={hoy}
                      value={fecha}
                      onChange={(e) => {
                        setFecha(e.target.value);
                        limpiarHora();
                      }}
                      className={cn("h-8 w-40 pl-8", !proximos.includes(fecha) && "border-primary")}
                    />
                  </label>
                </div>
                <Select
                  value={idEmpleado ? String(idEmpleado) : CUALQUIERA}
                  onValueChange={(v) => {
                    setEmpleado(v);
                    limpiarHora();
                  }}
                  disabled={!servicio}
                >
                  <SelectTrigger aria-label="Profesional">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUALQUIERA}>Cualquier profesional (asignación automática)</SelectItem>
                    {quienes.map((p) => (
                      <SelectItem key={p.id_empleado} value={String(p.id_empleado)}>
                        {nombreCompleto(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!servicio || !sede ? (
                  <p className="text-body text-subtle">Elige el servicio para ver los horarios libres.</p>
                ) : horarios.isPending ? (
                  <Skeleton className="h-24" />
                ) : horarios.isError ? (
                  <Alert tono="error">{horarios.error.message}</Alert>
                ) : libres && libres.length > 0 ? (
                  <div role="radiogroup" aria-label="Horarios libres" className="flex flex-wrap gap-2">
                    {libres.map((h) => (
                      <button
                        key={h.hora_inicio}
                        type="button"
                        role="radio"
                        aria-checked={hora === h.hora_inicio}
                        onClick={() => setHora(h.hora_inicio)}
                        className={cn(
                          "h-8 rounded-control border px-3 text-body font-medium tabular-nums",
                          hora === h.hora_inicio
                            ? "border-primary bg-primary text-white"
                            : "bg-white text-ink hover:bg-surface",
                        )}
                      >
                        {h.hora_inicio}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-body text-muted">{horarios.data?.motivo_sin_horarios}</p>
                )}
              </section>

              <section>
                <label
                  htmlFor="notas-nueva-cita"
                  className="mb-1.5 block text-label font-semibold tracking-wide text-muted uppercase"
                >
                  Notas internas
                </label>
                <Textarea
                  id="notas-nueva-cita"
                  value={notas}
                  maxLength={2000}
                  placeholder="Opcional"
                  onChange={(e) => setNotas(e.target.value)}
                />
              </section>
              {error && <Alert tono="error">{error}</Alert>}
              {intentado && faltante && <Alert tono="advertencia">{faltante}.</Alert>}
            </div>
          </div>

          <DialogFooter className="items-center">
            <p className="mr-auto truncate text-body text-muted" aria-live="polite">
              {resumen.join(" · ")}
            </p>
            <Button variant="secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button cargando={crear.isPending} onClick={enviar}>
              Agendar cita (queda confirmada)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {registrando && (
        <RegistrarClienteDialog
          inicial={registrando}
          textoBoton="Registrar y agendar cita"
          onCerrar={() => setRegistrando(null)}
          onRegistrado={registrado}
          onBuscar={() => setRegistrando(null)}
        />
      )}
      {agregandoMascota && cliente && (
        <AgregarMascotaDialog
          idUsuario={cliente.id_usuario}
          nombreCliente={nombreCompleto(cliente)}
          onCerrar={() => setAgregandoMascota(false)}
          onAgregada={(m) => {
            setAgregandoMascota(false);
            setCliente({
              ...cliente,
              mascotas: [
                ...(mascotas ?? []),
                { id_mascota: m.id_mascota, nombre: m.nombre, especie: m.especie },
              ],
            });
            setIdMascota(m.id_mascota);
            limpiarHora();
          }}
        />
      )}
    </>
  );
}
