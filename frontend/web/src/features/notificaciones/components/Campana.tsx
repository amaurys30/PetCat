import { Bell } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Notificacion } from "@/api/notificaciones";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { textoContador } from "../destino";
import { useAbrirNotificacion } from "../hooks/useAbrirNotificacion";
import { useLeerTodas, useNoLeidas, useRecientes } from "../hooks/useNotificaciones";
import { ItemNotificacion } from "./ItemNotificacion";
import { OpcionAvisosNavegador } from "./OpcionAvisosNavegador";

/** E5 · Campana del Topbar: contador de no leídas y desplegable con las más recientes. */
export function Campana() {
  const negocio = useNegocioActivo();
  const [abierta, setAbierta] = useState(false);
  const noLeidas = useNoLeidas().data?.total ?? 0;
  const recientes = useRecientes(abierta);
  const leerTodas = useLeerTodas();
  const abrirNotificacion = useAbrirNotificacion();
  const abrir = (n: Notificacion) => {
    setAbierta(false);
    abrirNotificacion(n);
  };
  const lista = recientes.data?.data ?? [];

  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        className="relative flex size-9 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink"
      >
        <Bell className="size-5" />
        {noLeidas > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {textoContador(noLeidas)}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0" aria-label="Notificaciones">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-card font-semibold text-ink">Notificaciones</h2>
          {noLeidas > 0 && (
            <Button
              variant="link"
              size="sm"
              cargando={leerTodas.isPending}
              onClick={() => leerTodas.mutate()}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {recientes.isPending ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : recientes.isError ? (
            <p className="px-4 py-6 text-center text-body text-muted">
              No se pudieron cargar las notificaciones.
            </p>
          ) : lista.length === 0 ? (
            <p className="px-4 py-6 text-center text-body text-muted">No tienes notificaciones.</p>
          ) : (
            <ul className="divide-y">
              {lista.map((n) => (
                <li key={n.id_notificacion}>
                  <ItemNotificacion notificacion={n} onAbrir={abrir} compacta />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t px-4 py-3">
          <OpcionAvisosNavegador />
          <Link
            to={`/n/${negocio.id_negocio}/notificaciones`}
            onClick={() => setAbierta(false)}
            className="text-center text-body font-semibold text-primary hover:underline"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
