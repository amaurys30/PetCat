import { Link } from "react-router";
import type { Servicio } from "@/api/servicios";
import { Avatar } from "@/components/common/Avatar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmpleados } from "@/features/equipo/hooks/useEquipo";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { cn } from "@/lib/utils";

const FILTRO_ACTIVOS = { activo: true, limit: 100 };

/**
 * D2 · Profesionales que atienden el servicio. Es la misma asignación que "Servicios que
 * atiende" en el formulario del miembro (P2): las dos pantallas escriben en la API y recargan
 * la consulta de la otra. Solo se listan miembros activos (la API conserva las asignaciones
 * de los inactivos para cuando se reactiven). Sin `empleados.ver` no se puede listar el
 * equipo: se ven los asignados, sin cambiarlos.
 */
export function ProfesionalesServicio({
  servicio,
  valor,
  onChange,
  editable,
  requiereCita,
  error,
}: {
  servicio: Servicio | null;
  valor: number[];
  onChange: (ids: number[]) => void;
  editable: boolean;
  requiereCita: boolean;
  error?: string;
}) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const puedeVerEquipo = puede("empleados", "ver");
  const empleados = useEmpleados(negocio.id_negocio, FILTRO_ACTIVOS, puedeVerEquipo);
  const lista = puedeVerEquipo ? empleados.data?.data : undefined;

  const alternar = (id: number) =>
    onChange(valor.includes(id) ? valor.filter((v) => v !== id) : [...valor, id]);

  const ayuda = !requiereCita
    ? "No requiere cita: se atiende por orden de llegada y los profesionales son opcionales."
    : valor.length === 0
      ? "Sin profesionales, el servicio no se puede reservar."
      : "Solo ellos aparecen al agendar este servicio.";

  return (
    <Card
      id="profesionales"
      tabIndex={-1}
      className="p-5 outline-none"
      aria-labelledby="titulo-profesionales"
    >
      <h3 id="titulo-profesionales" className="text-card font-semibold text-ink">
        Profesionales que lo atienden{requiereCita && " *"}
      </h3>
      <p
        className={cn("mt-0.5 text-label", requiereCita && valor.length === 0 ? "text-danger" : "text-muted")}
      >
        {ayuda}
      </p>

      {!puedeVerEquipo ? (
        <>
          <ListaSoloLectura servicio={servicio} />
          <p className="mt-3 text-label text-muted">
            Para cambiar los profesionales necesitas el permiso de ver el equipo.
          </p>
        </>
      ) : empleados.isPending ? (
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : empleados.isError ? (
        <p className="mt-3 text-body text-danger">No se pudo cargar el equipo: {empleados.error.message}</p>
      ) : lista?.length === 0 ? (
        <p className="mt-3 text-body text-muted">
          Todavía no hay miembros activos en el equipo.{" "}
          {puede("empleados", "crear") && (
            <Link to="../../equipo/miembros" className="font-semibold text-primary hover:underline">
              Agregar miembros
            </Link>
          )}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1" aria-label="Profesionales">
          {lista?.map((e) => {
            const nombre = `${e.nombre} ${e.apellido}`;
            const id = `profesional-${e.id_empleado}`;
            return (
              <li key={e.id_empleado}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex items-center gap-3 rounded-control px-1 py-1.5",
                    editable && "cursor-pointer hover:bg-surface",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={valor.includes(e.id_empleado)}
                    disabled={!editable}
                    onCheckedChange={() => alternar(e.id_empleado)}
                  />
                  <Avatar nombre={nombre} fotoUrl={e.foto_miniatura_url} tamano="sm" tono="suave" />
                  <span className="min-w-0 text-body text-ink">
                    {nombre}
                    <span className="text-muted"> · {e.especialidad ?? e.rol.nombre}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-label text-danger">{error}</p>}
    </Card>
  );
}

function ListaSoloLectura({ servicio }: { servicio: Servicio | null }) {
  const asignados = servicio?.empleados ?? [];
  if (asignados.length === 0) return <p className="mt-3 text-body text-muted">Ninguno asignado.</p>;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {asignados.map((e) => {
        const nombre = `${e.nombre} ${e.apellido}`;
        return (
          <li key={e.id_empleado} className="flex items-center gap-3 text-body text-ink">
            <Avatar nombre={nombre} tamano="sm" tono="suave" />
            {nombre}
          </li>
        );
      })}
    </ul>
  );
}
