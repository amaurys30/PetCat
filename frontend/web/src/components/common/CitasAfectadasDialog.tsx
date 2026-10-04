import { CalendarX2, Copy } from "lucide-react";
import type { CitaAfectada } from "@/api/negocios";
import { aviso } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { textoCitasFuera } from "@/lib/citas";
import { fechaCorta, hora } from "@/lib/format";
import { useUi } from "@/stores/ui";

const cliente = (c: CitaAfectada) => `${c.cliente.nombre} ${c.cliente.apellido}`;

/** Texto plano de la lista, para pegarlo donde haga falta (la API no la vuelve a dar). */
const textoCitasAfectadas = (citas: readonly CitaAfectada[]) =>
  citas
    .map(
      (c) =>
        `${fechaCorta(c.fecha)} ${hora(c.hora_inicio)}–${hora(c.hora_fin)} · ${c.servicio.nombre} · ${c.mascota.nombre} · ${cliente(c)}${c.cliente.telefono ? ` · ${c.cliente.telefono}` : ""}`,
    )
    .join("\n");

/**
 * El cambio ya se guardó y estas citas futuras están fuera de la disponibilidad. La API
 * devuelve todas las que no caben, también las que ya estaban fuera antes del cambio, para
 * que ninguna se olvide. Muestra lo necesario para llamar a cada cliente. La lista solo viene
 * en la respuesta del guardado, así que se ofrece copiarla. Se abre con
 * `useUi().mostrarCitasAfectadas` y vive en Raiz.
 */
export function CitasAfectadasDialog() {
  const afectadas = useUi((s) => s.citasAfectadas);
  const onCerrar = useUi((s) => s.cerrarCitasAfectadas);
  const citas = afectadas?.citas;
  const n = citas?.length ?? 0;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCitasAfectadas(citas ?? []));
      aviso.exito("Lista copiada");
    } catch {
      aviso.error("No se pudo copiar. Selecciona el texto de la tabla.");
    }
  };

  return (
    <Dialog open={n > 0} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-[720px]">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
          <CalendarX2 className="size-6" aria-hidden />
        </span>
        <DialogTitle>
          {afectadas?.guardado}. {textoCitasFuera(n)}
        </DialogTitle>
        <DialogDescription className="mt-2">
          Incluye las que ya estaban fuera antes de este cambio, para que ninguna se olvide. Avísale a cada
          cliente para reasignarla, reprogramarla o cancelarla. Esta lista no se vuelve a mostrar: cópiala si
          la necesitas después.
        </DialogDescription>
        <div className="mt-4 max-h-80 overflow-y-auto rounded-control border">
          <table className="w-full text-left text-body">
            <thead className="sticky top-0 bg-track text-label text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Hora</th>
                <th className="px-3 py-2 font-semibold">Servicio</th>
                <th className="px-3 py-2 font-semibold">Mascota</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {citas?.map((c) => (
                <tr key={c.id_cita} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(c.fecha)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {hora(c.hora_inicio)}–{hora(c.hora_fin)}
                  </td>
                  <td className="px-3 py-2">{c.servicio.nombre}</td>
                  <td className="px-3 py-2">{c.mascota.nombre}</td>
                  <td className="px-3 py-2">{cliente(c)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.cliente.telefono ? (
                      <a href={`tel:${c.cliente.telefono}`} className="text-primary hover:underline">
                        {c.cliente.telefono}
                      </a>
                    ) : (
                      <span className="text-subtle">Sin teléfono</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => void copiar()}>
            <Copy /> Copiar lista
          </Button>
          <Tooltip texto="Llega con la agenda (P4)">
            <span>
              <Button variant="secondary" disabled>
                Ver en la agenda
              </Button>
            </span>
          </Tooltip>
          <Button onClick={onCerrar}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
