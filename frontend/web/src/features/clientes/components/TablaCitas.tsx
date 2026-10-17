import type { CitaPanel } from "@/api/citas";
import { EstadoCitaBadge } from "@/components/common/EstadoCitaBadge";
import { nombreProfesional } from "@/features/agenda/textos";
import { cn } from "@/lib/utils";
import { fechaCita } from "../textos";

/** Citas de un cliente con el negocio: fecha, servicio, mascota, profesional y estado. */
export function TablaCitas({ citas, onAbrir }: { citas: CitaPanel[]; onAbrir?: (c: CitaPanel) => void }) {
  return (
    <div className="overflow-hidden rounded-card border">
      <table className="w-full text-left text-body">
        <thead className="bg-track text-label font-semibold tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Servicio</th>
            <th className="px-4 py-2.5">Mascota</th>
            <th className="px-4 py-2.5">Profesional</th>
            <th className="px-4 py-2.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {citas.map((c) => (
            <tr
              key={c.id_cita}
              className={cn("border-t", onAbrir && "cursor-pointer hover:bg-surface")}
              onClick={onAbrir ? () => onAbrir(c) : undefined}
            >
              <td className="px-4 py-3">
                {onAbrir ? (
                  <button
                    type="button"
                    className="text-left font-medium text-ink hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAbrir(c);
                    }}
                  >
                    {fechaCita(c)}
                  </button>
                ) : (
                  fechaCita(c)
                )}
              </td>
              <td className="px-4 py-3">{c.servicio.nombre}</td>
              <td className="px-4 py-3">{c.mascota.nombre}</td>
              <td className="px-4 py-3">{nombreProfesional(c)}</td>
              <td className="px-4 py-3">
                <EstadoCitaBadge estado={c.estado} cancelacion={c.cancelacion} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
