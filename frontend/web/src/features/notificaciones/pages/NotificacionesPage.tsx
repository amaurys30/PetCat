import { Bell } from "lucide-react";
import { useSearchParams } from "react-router";
import { Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CargandoGrupo, Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemNotificacion } from "../components/ItemNotificacion";
import { useAbrirNotificacion } from "../hooks/useAbrirNotificacion";
import { OpcionAvisosNavegador } from "../components/OpcionAvisosNavegador";
import { useLeerTodas, useListaNotificaciones, useNoLeidas } from "../hooks/useNotificaciones";

/**
 * Todas las notificaciones del panel (de todos los negocios del usuario), de 20 en 20, con
 * la pestaña No leídas en la URL (`?ver=no-leidas`). No tiene pantalla en el Figma: sigue el
 * desplegable de la campana (E5).
 */
export function NotificacionesPage() {
  const [params, setParams] = useSearchParams();
  const soloNoLeidas = params.get("ver") === "no-leidas";
  const lista = useListaNotificaciones(soloNoLeidas);
  const noLeidas = useNoLeidas().data?.total ?? 0;
  const leerTodas = useLeerTodas();
  const abrir = useAbrirNotificacion();
  const notificaciones = lista.data?.pages.flatMap((p) => p.data) ?? [];
  const pestana = soloNoLeidas ? "no-leidas" : "todas";

  return (
    <Tabs
      value={pestana}
      onValueChange={(v) => setParams(v === "no-leidas" ? { ver: "no-leidas" } : {})}
      className="mx-auto flex max-w-[760px] flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-4">
        <TabsList aria-label="Filtrar notificaciones">
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="no-leidas">No leídas{noLeidas > 0 ? ` (${noLeidas})` : ""}</TabsTrigger>
        </TabsList>
        {noLeidas > 0 && (
          <Button variant="secondary" cargando={leerTodas.isPending} onClick={() => leerTodas.mutate()}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Un panel por pestaña (aria-controls de cada una apunta al suyo); la lista va en el activo. */}
      {(["todas", "no-leidas"] as const).map((valor) =>
        valor === pestana ? null : <TabsContent key={valor} value={valor} forceMount hidden />,
      )}
      <TabsContent value={pestana} className="flex flex-col gap-4">
        <Card className="overflow-hidden p-0">
          {lista.isPending ? (
            <CargandoGrupo etiqueta="Cargando notificaciones" className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </CargandoGrupo>
          ) : lista.isError ? (
            <ErrorConsulta error={lista.error} reintentar={() => void lista.refetch()} />
          ) : notificaciones.length === 0 ? (
            <Vacio
              icono={Bell}
              titulo={soloNoLeidas ? "No tienes notificaciones sin leer" : "No tienes notificaciones"}
              descripcion="Aquí llegan las reservas nuevas, las cancelaciones, las reseñas y los avisos de tu plan."
            />
          ) : (
            <ul className="divide-y">
              {notificaciones.map((n) => (
                <li key={n.id_notificacion}>
                  <ItemNotificacion notificacion={n} onAbrir={abrir} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        {lista.hasNextPage && (
          <Button
            variant="secondary"
            className="self-center"
            cargando={lista.isFetchingNextPage}
            onClick={() => void lista.fetchNextPage()}
          >
            Cargar más
          </Button>
        )}
      </TabsContent>
      <Card className="p-4">
        <OpcionAvisosNavegador />
      </Card>
    </Tabs>
  );
}
