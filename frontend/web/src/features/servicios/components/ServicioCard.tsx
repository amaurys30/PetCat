import { MoreHorizontal } from "lucide-react";
import { createElement } from "react";
import { Link } from "react-router";
import type { Servicio } from "@/api/servicios";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { usePuede } from "@/features/negocios/hooks/useNegocio";
import { dinero, fechaCorta, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  estadoOferta,
  iconoCategoria,
  sinProfesionales,
  textoDuracion,
  textoEspecies,
  textoPrecio,
} from "../textos";

const MAX_AVATARES = 4;

/** D1 · Tarjeta de un servicio del catálogo. */
export function ServicioCard({
  servicio: s,
  icono,
  onDesactivar,
  onReactivar,
  onVisibilidad,
}: {
  servicio: Servicio;
  icono: string | null | undefined;
  onDesactivar: () => void;
  onReactivar: () => void;
  onVisibilidad: () => void;
}) {
  const puede = usePuede();
  const oferta = estadoOferta(s, hoyISO());
  const sinPro = sinProfesionales(s);
  const nombres = s.empleados.map((e) => `${e.nombre} ${e.apellido}`);

  const acciones: { texto: string; peligro?: boolean; onSelect: () => void }[] = [];
  if (puede("servicios", "editar") && s.activo) {
    acciones.push({
      texto: s.visible_app ? "Ocultar en la app" : "Mostrar en la app",
      onSelect: onVisibilidad,
    });
  }
  if (s.activo && puede("servicios", "eliminar")) {
    acciones.push({ texto: "Desactivar", peligro: true, onSelect: onDesactivar });
  }
  if (!s.activo && puede("servicios", "editar")) acciones.push({ texto: "Reactivar", onSelect: onReactivar });

  return (
    <Card className={cn("flex w-full flex-col p-4", !s.activo && "bg-surface")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-control",
            s.activo ? "bg-primary-soft text-primary-dark" : "bg-track text-muted",
          )}
        >
          {createElement(iconoCategoria(icono), { className: "size-5", "aria-hidden": true })}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-card font-semibold text-ink">
            <Link to={String(s.id_servicio)} className="hover:underline">
              {s.nombre}
            </Link>
          </h3>
          <p className="truncate text-label text-muted">{s.categoria.nombre}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Acciones de ${s.nombre}`}>
              <MoreHorizontal className="text-muted" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={String(s.id_servicio)}>
                {puede("servicios", "editar") ? "Editar" : "Ver detalle"}
              </Link>
            </DropdownMenuItem>
            {acciones.map((a) => (
              <DropdownMenuItem
                key={a.texto}
                className={a.peligro ? "text-danger" : undefined}
                onSelect={a.onSelect}
              >
                {a.texto}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.activo ? <Badge tono="primary">Activo</Badge> : <Badge tono="neutral">Inactivo</Badge>}
        <Badge tono="neutral">{textoEspecies(s.tipo_mascota)}</Badge>
        {oferta === "vigente" && <Badge tono="warning">En oferta</Badge>}
        {oferta === "programada" && s.fecha_inicio_oferta && (
          <Badge tono="info">Oferta desde el {fechaCorta(s.fecha_inicio_oferta)}</Badge>
        )}
        {oferta === "vencida" && <Badge tono="neutral">Oferta vencida</Badge>}
        {!s.visible_app && <Badge tono="neutral">Oculto en la app</Badge>}
        {!s.requiere_cita && <Badge tono="info">Sin cita · por orden de llegada</Badge>}
      </div>

      <dl className="mt-3 flex gap-6">
        <div className="min-w-0">
          <dt className="text-label text-muted">Precio</dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-ink">
              {textoPrecio({
                precio: s.precio_actual,
                precio_maximo: s.precio_maximo,
                tipo_precio: s.tipo_precio,
              })}
            </span>
            {s.oferta_vigente && (
              <span className="text-label text-subtle line-through">
                <span className="sr-only">Antes </span>
                {dinero(s.precio_base)}
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-label text-muted">Duración</dt>
          <dd className="text-body font-semibold text-ink">
            {textoDuracion(s.duracion_minutos, s.margen_minutos)}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        {sinPro ? (
          <span className="text-body font-semibold text-danger">Sin profesionales</span>
        ) : !s.requiere_cita ? (
          <span className="text-body text-muted">No requiere cita</span>
        ) : (
          <Tooltip texto={nombres.join(", ")}>
            <span className="flex -space-x-1.5" aria-label={`Profesionales: ${nombres.join(", ")}`}>
              {s.empleados.slice(0, MAX_AVATARES).map((e) => (
                <Avatar
                  key={e.id_empleado}
                  nombre={`${e.nombre} ${e.apellido}`}
                  tamano="sm"
                  tono="suave"
                  className="ring-2 ring-white"
                />
              ))}
              {nombres.length > MAX_AVATARES && (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-track text-[10px] font-bold text-muted ring-2 ring-white">
                  +{nombres.length - MAX_AVATARES}
                </span>
              )}
            </span>
          </Tooltip>
        )}
        {s.activo &&
          (s.reservable ? (
            <Badge tono="primary">Reservable</Badge>
          ) : (
            <Badge tono="danger">No reservable</Badge>
          ))}
      </div>
    </Card>
  );
}
