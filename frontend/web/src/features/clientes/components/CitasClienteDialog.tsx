import type { CitaPanel } from "@/api/citas";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { useCitasCliente } from "../hooks/useClientes";
import { plural } from "../textos";
import { TablaCitas } from "./TablaCitas";

/** "Ver todas": todas las citas del cliente con el negocio, de la más reciente hacia atrás. */
export function CitasClienteDialog({
  idUsuario,
  nombre,
  onAbrir,
  onCerrar,
}: {
  idUsuario: number;
  nombre: string;
  onAbrir?: (cita: CitaPanel) => void;
  onCerrar: () => void;
}) {
  const negocio = useNegocioActivo();
  const citas = useCitasCliente(negocio.id_negocio, idUsuario, true);
  const filas = citas.data?.pages.flatMap((p) => p.data) ?? [];
  const total = citas.data?.pages[0]?.meta.total;
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>Citas de {nombre}</DialogTitle>
        <DialogDescription>
          {total === undefined
            ? "Solo las citas con tu negocio."
            : `${plural(total, "cita", "citas")} con tu negocio.`}
        </DialogDescription>
        <div className="max-h-[60vh] overflow-y-auto">
          {citas.isPending ? (
            <Skeleton etiqueta="Cargando citas" className="h-40" />
          ) : citas.isError ? (
            <ErrorConsulta error={citas.error} reintentar={() => void citas.refetch()} />
          ) : (
            <TablaCitas
              citas={filas}
              onAbrir={
                onAbrir &&
                ((c) => {
                  onCerrar();
                  onAbrir(c);
                })
              }
            />
          )}
        </div>
        {citas.hasNextPage && (
          <Button
            variant="secondary"
            onClick={() => void citas.fetchNextPage()}
            disabled={citas.isFetchingNextPage}
          >
            {citas.isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
