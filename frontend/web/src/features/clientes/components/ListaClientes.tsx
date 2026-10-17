import { Plus, Search, Users } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import type { ClienteFila, OrdenClientes } from "@/api/clientes";
import { Avatar } from "@/components/common/Avatar";
import { Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { nombreCompleto } from "@/features/agenda/textos";
import { fechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useListaClientes } from "../hooks/useClientes";
import { esClienteNuevo, plural, TEXTO_SIN_CUENTA } from "../textos";

const ORDENES: { valor: OrdenClientes; texto: string }[] = [
  { valor: "ultima_cita", texto: "Última cita" },
  { valor: "nombre", texto: "Nombre" },
  { valor: "inasistencias", texto: "Inasistencias" },
];

/** Espera a que se deje de escribir para buscar (una consulta por búsqueda, no por tecla). */
function useConEspera(valor: string, ms = 300) {
  const [conEspera, setConEspera] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setConEspera(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return conEspera;
}

/**
 * Lista de C1: búsqueda por nombre, correo, teléfono o mascota, orden y "Cargar más". Sin
 * cliente elegido, elige el primero (como el mockup).
 */
export function ListaClientes({
  busqueda,
  onBusqueda,
  idElegido,
  onElegir,
  onNuevo,
}: {
  busqueda: string;
  onBusqueda: (texto: string) => void;
  idElegido: number | null;
  onElegir: (idUsuario: number, opciones?: { reemplazar: boolean }) => void;
  /** Sin citas.crear no se ofrece registrar clientes. */
  onNuevo?: () => void;
}) {
  const negocio = useNegocioActivo();
  const [orden, setOrden] = useState<OrdenClientes>("ultima_cita");
  const q = useConEspera(busqueda.trim());
  const lista = useListaClientes(negocio.id_negocio, { q, orden });
  const filas = lista.data?.pages.flatMap((p) => p.data) ?? [];
  const total = lista.data?.pages[0]?.meta.total;

  const elegirPrimero = useEffectEvent((primero: number) => {
    if (idElegido === null) onElegir(primero, { reemplazar: true });
  });
  const primero = filas[0]?.id_usuario;
  useEffect(() => {
    if (primero !== undefined) elegirPrimero(primero);
  }, [primero]);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            type="search"
            aria-label="Buscar clientes"
            placeholder="Nombre, correo, teléfono o mascota"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        {onNuevo && (
          <Button onClick={onNuevo}>
            <Plus /> Cliente
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-muted" aria-live="polite">
          {total === undefined
            ? " "
            : q
              ? plural(total, "resultado", "resultados")
              : `${plural(total, "cliente", "clientes")} · con citas o registrados por tu negocio`}
        </p>
        <Select value={orden} onValueChange={(v) => setOrden(v as OrdenClientes)}>
          <SelectTrigger aria-label="Ordenar por" className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDENES.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.texto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {lista.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Cargando clientes">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      ) : lista.isError ? (
        <ErrorConsulta error={lista.error} reintentar={() => void lista.refetch()} />
      ) : filas.length === 0 ? (
        q ? (
          <Vacio
            icono={Search}
            titulo="Sin resultados"
            descripcion={`Ningún cliente coincide con "${q}".`}
            className="py-8"
          />
        ) : (
          <Vacio
            icono={Users}
            titulo="Aún no tienes clientes"
            descripcion="Aparecen al agendar su primera cita o al registrarlos desde aquí."
            className="py-8"
          />
        )
      ) : (
        <ul className="flex flex-col gap-1" aria-label="Clientes">
          {filas.map((c) => (
            <li key={c.id_usuario}>
              <FilaCliente
                cliente={c}
                elegido={c.id_usuario === idElegido}
                onElegir={() => onElegir(c.id_usuario)}
              />
            </li>
          ))}
        </ul>
      )}
      {lista.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void lista.fetchNextPage()}
          disabled={lista.isFetchingNextPage}
        >
          {lista.isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </Button>
      )}
    </Card>
  );
}

function FilaCliente({
  cliente: c,
  elegido,
  onElegir,
}: {
  cliente: ClienteFila;
  elegido: boolean;
  onElegir: () => void;
}) {
  const actividad = c.proxima_cita
    ? `Próxima: ${fechaCorta(c.proxima_cita)}`
    : c.ultima_cita
      ? `Última: ${fechaCorta(c.ultima_cita)}`
      : c.registrado_por_el_negocio
        ? "Registrado aquí"
        : null;
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-current={elegido ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors",
        elegido ? "border-primary bg-selected" : "border-transparent hover:bg-surface",
      )}
    >
      <Avatar nombre={nombreCompleto(c)} tono="suave" tamano="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{nombreCompleto(c)}</span>
        <span className="block truncate text-label text-muted">
          {[c.telefono ?? c.email, plural(c.total_citas, "cita", "citas")].filter(Boolean).join(" · ")}
        </span>
        {actividad && <span className="block truncate text-label text-muted">{actividad}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {c.inasistencias > 0 && (
          <Badge tono={c.inasistencias >= 3 ? "danger" : "neutral"}>{c.inasistencias} inasist.</Badge>
        )}
        {c.email === null ? (
          <Tooltip texto={TEXTO_SIN_CUENTA}>
            <span>
              <Badge>Sin cuenta</Badge>
            </span>
          </Tooltip>
        ) : (
          !c.usa_app && <Badge tono="info">Sin app</Badge>
        )}
        {esClienteNuevo(c) && <Badge tono="primary">Nuevo</Badge>}
      </span>
    </button>
  );
}
