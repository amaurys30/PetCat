import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { EstadoPlanAdmin, FiltrosAdmin, NegocioAdmin } from "@/api/admin";
import { Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CargandoGrupo, Skeleton } from "@/components/ui/skeleton";
import { usePlanes } from "@/features/negocios/hooks/useGestion";
import { dinero, fechaCorta, fechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AsignarPlanForm } from "../components/AsignarPlanForm";
import { useHistorialSuscripciones, useNegociosAdmin } from "../hooks/useAdmin";
import {
  ESTADO_HISTORIAL,
  ESTADO_PLAN,
  SIN_VENCIMIENTO,
  textoCitasMes,
  textoRegistro,
  textoTipo,
  textoVence,
} from "../textos";

const TODOS = "todos";

/**
 * X1 · Negocios y planes: tabla con búsqueda y filtros (en la URL), y a la derecha el
 * negocio elegido (`?negocio=`) para asignarle un plan, con el historial de sus
 * suscripciones y quién creó cada una.
 */
export function AdminNegociosPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const idPlan = Number(params.get("plan")) || undefined;
  const estado = (params.get("estado") as EstadoPlanAdmin | null) ?? undefined;
  const page = Number(params.get("page")) || 1;
  const idElegido = Number(params.get("negocio")) || null;
  const filtros: FiltrosAdmin = { q: q || undefined, id_plan: idPlan, estado };
  const negocios = useNegociosAdmin(filtros, page);
  const planes = usePlanes();

  const cambiar = (cambios: Record<string, string | null>, { mantenerPagina = false } = {}) =>
    setParams((actuales) => {
      const nuevos = new URLSearchParams(actuales);
      if (!mantenerPagina) nuevos.delete("page");
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === "") nuevos.delete(k);
        else nuevos.set(k, v);
      }
      return nuevos;
    });

  // Búsqueda: 300 ms después de dejar de escribir. El temporizador usa el `cambiar` del último
  // render: con el de cuando se creó, pisaría lo que cambió mientras tanto (el negocio elegido).
  const [texto, setTexto] = useState(q);
  const cambiarActual = useRef(cambiar);
  useEffect(() => {
    cambiarActual.current = cambiar;
  });
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => cambiarActual.current({ q: texto.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const filas = negocios.data?.data ?? [];
  const meta = negocios.data?.meta;
  const elegido = filas.find((n) => n.id_negocio === idElegido) ?? null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input
              aria-label="Buscar negocio"
              placeholder="Buscar negocio, ciudad o correo del propietario…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={idPlan ? String(idPlan) : TODOS}
            onValueChange={(v) => cambiar({ plan: v === TODOS ? null : v })}
          >
            <SelectTrigger aria-label="Plan" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los planes</SelectItem>
              {planes.data?.map((p) => (
                <SelectItem key={p.id_plan} value={String(p.id_plan)}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estado ?? TODOS} onValueChange={(v) => cambiar({ estado: v === TODOS ? null : v })}>
            <SelectTrigger aria-label="Estado" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los estados</SelectItem>
              {(Object.keys(ESTADO_PLAN) as EstadoPlanAdmin[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {ESTADO_PLAN[e].texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden p-0">
          {negocios.isPending ? (
            <CargandoGrupo etiqueta="Cargando negocios" className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </CargandoGrupo>
          ) : negocios.isError ? (
            <ErrorConsulta error={negocios.error} reintentar={() => void negocios.refetch()} />
          ) : filas.length === 0 ? (
            <Vacio titulo="Ningún negocio con estos filtros" />
          ) : (
            <table className={cn("w-full text-body", negocios.isPlaceholderData && "opacity-60")}>
              <caption className="sr-only">Negocios de PetCat</caption>
              <thead className="bg-track text-left text-label font-semibold tracking-wide whitespace-nowrap text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Negocio</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Vence</th>
                  <th className="px-4 py-2.5">Citas/mes</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((n) => (
                  <FilaNegocio
                    key={n.id_negocio}
                    negocio={n}
                    elegido={n.id_negocio === idElegido}
                    onElegir={() => cambiar({ negocio: String(n.id_negocio) }, { mantenerPagina: true })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Card>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-body text-muted">
            <span>
              Página {meta.page} de {meta.totalPages} · {meta.total} negocios
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => cambiar({ page: String(meta.page - 1) }, { mantenerPagina: true })}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!meta.hasNext}
                onClick={() => cambiar({ page: String(meta.page + 1) }, { mantenerPagina: true })}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
        <p className="rounded-control bg-track px-4 py-2.5 text-label text-muted">
          Próximamente (Fase 4): verificar y destacar negocios, moderar reseñas reportadas, configuración
          global y auditoría.
        </p>
      </div>

      <div className="sticky top-0 flex flex-col gap-5">
        {elegido && planes.data ? (
          <>
            <Card className="p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="text-card font-semibold text-ink">Asignar plan · {elegido.nombre}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar"
                  onClick={() => cambiar({ negocio: null }, { mantenerPagina: true })}
                >
                  <X />
                </Button>
              </div>
              <AsignarPlanForm key={elegido.id_negocio} negocio={elegido} planes={planes.data} />
            </Card>
            <Historial negocio={elegido} />
          </>
        ) : (
          <Card className="p-5 text-body text-muted">
            Elige un negocio de la tabla para asignarle un plan y ver su historial de suscripciones.
          </Card>
        )}
      </div>
    </div>
  );
}

function FilaNegocio({
  negocio: n,
  elegido,
  onElegir,
}: {
  negocio: NegocioAdmin;
  elegido: boolean;
  onElegir: () => void;
}) {
  const estado = ESTADO_PLAN[n.estado];
  return (
    <tr className={cn("border-t", elegido && "bg-selected")}>
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={onElegir}
          className="text-left font-semibold text-ink hover:text-primary hover:underline"
        >
          {n.nombre}
        </button>
        <span className="block text-label text-muted">
          {[n.ciudad, n.propietario.email].filter(Boolean).join(" · ")}
          {!n.activo && " · inactivo"}
        </span>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-muted">{textoTipo(n.tipo)}</td>
      <td className="px-4 py-2.5">
        <Badge tono={n.plan.nombre === "Gratuito" ? "neutral" : "primary"}>{n.plan.nombre}</Badge>
      </td>
      <td className="px-4 py-2.5">
        <Badge tono={estado.tono}>{estado.texto}</Badge>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular-nums">{textoVence(n)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular-nums">{textoCitasMes(n)}</td>
    </tr>
  );
}

function Historial({ negocio }: { negocio: NegocioAdmin }) {
  const historial = useHistorialSuscripciones(negocio.id_negocio);
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-card font-semibold text-ink">Historial de suscripciones</h2>
      {historial.isPending ? (
        <Skeleton etiqueta="Cargando historial de suscripciones" className="h-24" />
      ) : historial.isError ? (
        <p className="text-body text-muted">No se pudo cargar el historial.</p>
      ) : (
        <ol className="flex flex-col" aria-label={`Historial de ${negocio.nombre}`}>
          {historial.data.map((s) => (
            <li key={s.id_suscripcion} className="border-b py-2.5 last:border-b-0">
              <p className="flex items-center justify-between gap-2 text-body">
                <span className="font-semibold text-ink">
                  {s.plan.nombre} · {s.tipo_facturacion}
                </span>
                <Badge
                  tono={s.estado === "activa" ? "primary" : s.estado === "en_prueba" ? "info" : "neutral"}
                >
                  {ESTADO_HISTORIAL[s.estado]}
                </Badge>
              </p>
              <p className="text-label text-muted">
                {fechaCorta(s.fecha_inicio)} –{" "}
                {s.fecha_fin === SIN_VENCIMIENTO ? "sin vencimiento" : fechaCorta(s.fecha_fin)}
                {s.monto_pagado > 0 && ` · ${dinero(s.monto_pagado)}`}
              </p>
              <p className="text-label text-muted">
                {textoRegistro(s)} · {fechaHora(s.fecha_creacion)}
              </p>
              {s.notas && <p className="text-label text-subtle">{s.notas}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
