import { createElement } from "react";
import type { Notificacion } from "@/api/notificaciones";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { haceCuanto, iconoDe } from "../destino";

/** Una notificación de la campana o de la página "Todas": ícono, título, mensaje y hace cuánto. */
export function ItemNotificacion({
  notificacion: n,
  onAbrir,
  compacta = false,
}: {
  notificacion: Notificacion;
  onAbrir: (n: Notificacion) => void;
  compacta?: boolean;
}) {
  const usuario = useAuth((s) => s.usuario);
  // Con varios negocios, cuál es (las notificaciones son de la cuenta, no de un negocio).
  const negocio =
    (usuario?.negocios.length ?? 0) > 1 && n.id_negocio !== null
      ? usuario?.negocios.find((x) => x.id_negocio === n.id_negocio)?.nombre
      : undefined;
  return (
    <button
      type="button"
      onClick={() => onAbrir(n)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none",
        !n.leida && "bg-selected",
      )}
    >
      {createElement(iconoDe(n.tipo), {
        className: "mt-0.5 size-4 shrink-0 text-muted",
        "aria-hidden": true,
      })}
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold text-ink">{n.titulo}</span>
        <span className={cn("block text-label text-muted", compacta && "line-clamp-2")}>{n.mensaje}</span>
        <span className="mt-0.5 block text-label text-subtle">
          {haceCuanto(n.fecha_creacion)}
          {negocio && ` · ${negocio}`}
        </span>
      </span>
      {!n.leida && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" role="img" />
      )}
    </button>
  );
}
