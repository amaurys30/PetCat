import type { CitaPanel } from "@/api/citas";
import type { Excepcion } from "@/api/disponibilidad";
import type { Profesional } from "@/api/empleados";
import { Avatar } from "@/components/common/Avatar";
import type { SedeHorario } from "@/features/equipo/hooks/useDisponibilidad";
import { aHora, aMinutos, tramosCerrados, ventanaVisible, type Tramo, type TramoCerrado } from "@/lib/agenda";
import { useDisponibilidadDelDia } from "../hooks/useAgenda";
import { nombreCompleto } from "../textos";
import { Calendario } from "./Calendario";
import { abiertosDelDia, tramoDeCita } from "../calculos";

const SIN_PROFESIONAL = "sin-profesional";

const cubre = (e: Excepcion, fecha: string) =>
  e.fecha_especifica <= fecha && fecha <= (e.fecha_fin ?? e.fecha_especifica);

/**
 * Bloqueos y vacaciones del día, con su etiqueta. El texto libre solo llega con
 * configuracion.ver (o si es la propia disponibilidad); si no, solo el tipo.
 */
function bloqueosDelDia(excepciones: readonly Excepcion[], fecha: string, ventana: Tramo): TramoCerrado[] {
  return excepciones
    .filter((e) => (e.tipo === "bloqueo" || e.tipo === "vacacion") && cubre(e, fecha))
    .map((e) => {
      const motivo = e.motivo ? ` · ${e.motivo}` : "";
      if (e.tipo === "bloqueo" && e.hora_inicio && e.hora_fin) {
        const inicio = aMinutos(e.hora_inicio);
        const fin = aMinutos(e.hora_fin);
        return { inicio, fin, etiqueta: `Bloqueo ${aHora(inicio)}–${aHora(fin)}${motivo}` };
      }
      return {
        ...ventana,
        etiqueta: `${e.tipo === "vacacion" ? "Vacaciones" : "Bloqueo todo el día"}${motivo}`,
      };
    });
}

/**
 * B9 · Día por profesional: una columna por profesional que atiende servicios (o con citas
 * ese día), sombreada con su disponibilidad efectiva en la sede y con sus bloqueos.
 */
export function VistaDia({
  fecha,
  citas,
  profesionales,
  idSucursal,
  sedes,
  hoy,
  minutoActual,
  idSeleccionada,
  onAbrir,
}: {
  fecha: string;
  citas: CitaPanel[];
  /** Los que se muestran como columnas (ya filtrados por profesional o "Solo mis citas"). */
  profesionales: Profesional[];
  idSucursal?: number;
  sedes: readonly SedeHorario[];
  hoy: string;
  minutoActual: number;
  idSeleccionada?: number;
  onAbrir: (cita: CitaPanel) => void;
}) {
  const disponibilidad = useDisponibilidadDelDia(
    profesionales.map((p) => p.id_empleado),
    fecha,
  );
  const abiertosDe = (idEmpleado: number): Tramo[] | null => {
    const d = disponibilidad.find((x) => x.idEmpleado === idEmpleado)?.efectiva;
    if (!d) return null;
    return d.sucursales
      .filter((s) => idSucursal === undefined || s.id_sucursal === idSucursal)
      .flatMap((s) => s.rangos.map((r) => ({ inicio: aMinutos(r.hora_inicio), fin: aMinutos(r.hora_fin) })));
  };

  const sinProfesional = citas.some((c) => !c.empleado);
  const ventana = ventanaVisible([
    ...abiertosDelDia(sedes, fecha),
    ...profesionales.flatMap((p) => abiertosDe(p.id_empleado) ?? []),
    ...citas.map(tramoDeCita),
  ]);

  const columnas = profesionales.map((p) => {
    const abiertos = abiertosDe(p.id_empleado);
    const excepciones = disponibilidad.find((x) => x.idEmpleado === p.id_empleado)?.excepciones ?? [];
    const bloqueos = bloqueosDelDia(excepciones, fecha, ventana);
    return {
      clave: String(p.id_empleado),
      nombre: nombreCompleto(p),
      encabezado: (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar nombre={nombreCompleto(p)} fotoUrl={p.foto_miniatura_url} tamano="sm" tono="suave" />
          <span className="truncate">
            {nombreCompleto(p)}
            {p.especialidad && <span className="font-normal text-muted"> · {p.especialidad}</span>}
          </span>
        </span>
      ),
      // Mientras carga su disponibilidad no se sombrea nada. Lo que tapa un bloqueo o una
      // vacación no se marca además como cerrado: lo explica el bloqueo.
      cerrados:
        abiertos === null || bloqueos.some((b) => b.inicio <= ventana.inicio && b.fin >= ventana.fin)
          ? []
          : tramosCerrados([...abiertos, ...bloqueos], ventana).map((t) =>
              t.etiqueta === "Cerrado" ? { ...t, etiqueta: "No atiende este día" } : t,
            ),
      bloqueos,
    };
  });
  if (sinProfesional) {
    columnas.push({
      clave: SIN_PROFESIONAL,
      nombre: "Sin profesional",
      encabezado: <span className="text-muted">Sin profesional</span>,
      cerrados: tramosCerrados(abiertosDelDia(sedes, fecha), ventana),
      bloqueos: [],
    });
  }

  const claves = new Set(columnas.map((c) => c.clave));
  return (
    <Calendario
      vista="dia"
      ventana={ventana}
      columnas={columnas}
      citas={citas
        .map((cita) => ({
          cita,
          columna: cita.empleado ? String(cita.empleado.id_empleado) : SIN_PROFESIONAL,
        }))
        .filter((c) => claves.has(c.columna))}
      ahora={fecha === hoy ? { minuto: minutoActual, columnas: [...claves] } : null}
      idSeleccionada={idSeleccionada}
      onAbrir={onAbrir}
    />
  );
}
