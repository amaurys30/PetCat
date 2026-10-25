import { BadgeCheck, EyeOff, Flag, MoreHorizontal, Pencil, Star, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import type { ResenaPanel } from "@/api/resenas";
import { Avatar } from "@/components/common/Avatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { cn } from "@/lib/utils";
import { useBorrarRespuesta } from "../hooks/useResenas";
import { ASPECTOS, fechaDe, textoMotivo, textoVisita } from "../textos";
import { FormRespuesta } from "./FormRespuesta";

export function Estrellas({ valor, className }: { valor: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} role="img" aria-label={`${valor} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("size-4", i < valor ? "fill-warning text-warning" : "text-track")}
          aria-hidden
        />
      ))}
    </span>
  );
}

/**
 * Una reseña en el panel (E3). Publicada: se responde y se reporta según los permisos. Una
 * reportada sigue visible, con su marca. Retirada por el cliente u oculta por PetCat: se ve
 * atenuada y con su estado; la retirada ya no admite acciones.
 */
export function ResenaCard({
  resena,
  puedeResponder,
  puedeReportar,
  resaltada,
  onReportar,
}: {
  resena: ResenaPanel;
  puedeResponder: boolean;
  puedeReportar: boolean;
  resaltada?: boolean;
  onReportar: (resena: ResenaPanel) => void;
}) {
  const negocio = useNegocioActivo();
  const borrar = useBorrarRespuesta(negocio.id_negocio);
  const [editando, setEditando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const { cliente, respuesta, reporte, estado } = resena;
  const nombre = `${cliente.nombre} ${cliente.apellido}`;
  const retirada = estado === "retirada";
  const visita = textoVisita(resena.cita);
  const aspectos = ASPECTOS.filter((a) => resena.aspectos[a.clave] !== null);

  const acciones = [
    puedeReportar &&
      !retirada &&
      !reporte && { texto: "Reportar", icono: Flag, alElegir: () => onReportar(resena) },
    puedeResponder &&
      !retirada &&
      respuesta && { texto: "Editar respuesta", icono: Pencil, alElegir: () => setEditando(true) },
    puedeResponder &&
      !retirada &&
      respuesta && { texto: "Borrar respuesta", icono: Trash2, alElegir: () => setConfirmarBorrar(true) },
  ].filter(Boolean) as { texto: string; icono: typeof Flag; alElegir: () => void }[];

  return (
    <Card
      id={`resena-${resena.id_resena}`}
      role="article"
      aria-label={`Reseña de ${nombre}`}
      className={cn("p-5", reporte && !retirada && "border-danger/40", resaltada && "ring-2 ring-primary")}
    >
      <div className="flex items-start gap-3">
        <Avatar nombre={nombre} tono="suave" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-semibold text-ink">{nombre}</span>
            <span className="text-label text-subtle">se muestra como &quot;{resena.autor}&quot;</span>
          </p>
          {visita && (
            <p className="flex items-center gap-1 text-label text-muted">
              <BadgeCheck className="size-3.5 text-primary" aria-hidden />
              {visita}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {retirada && (
            <Badge tono="neutral">
              <Undo2 className="size-3" aria-hidden />
              Retirada por el cliente
            </Badge>
          )}
          {estado === "oculta" && (
            <Badge tono="neutral">
              <EyeOff className="size-3" aria-hidden />
              Oculta por PetCat
            </Badge>
          )}
          {reporte && !retirada && (
            <Badge tono="danger">
              Reportada · {estado === "oculta" ? "en revisión" : "sigue visible hasta revisión"}
            </Badge>
          )}
          {acciones.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Más acciones para la reseña de ${nombre}`}
                className="flex size-8 items-center justify-center rounded-control text-muted hover:bg-surface"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {acciones.map((a) => (
                  <DropdownMenuItem key={a.texto} onSelect={a.alElegir}>
                    <a.icono /> {a.texto}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className={cn("mt-3", (retirada || estado === "oculta") && "opacity-70")}>
        <Estrellas valor={resena.calificacion} />
        {resena.titulo && <p className="mt-2 text-card font-semibold text-ink">{resena.titulo}</p>}
        {resena.comentario && (
          <p className="mt-1 text-body whitespace-pre-line text-ink">{resena.comentario}</p>
        )}
        {aspectos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Calificación por aspecto">
            {aspectos.map((a) => (
              <li key={a.clave}>
                <Badge tono="neutral">
                  {a.texto} {resena.aspectos[a.clave]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-label text-subtle">
          {fechaDe(resena.fecha_creacion)}
          {resena.fecha_edicion && ` · editada el ${fechaDe(resena.fecha_edicion)}`}
          {retirada && resena.retirada_en && ` · retirada el ${fechaDe(resena.retirada_en)}`}
        </p>
      </div>

      {reporte && !retirada && (
        <p className="mt-2 text-label text-danger">
          Reportada por {textoMotivo(reporte.motivo).toLowerCase()}
          {reporte.reportada_por && ` · ${reporte.reportada_por.nombre} ${reporte.reportada_por.apellido}`}
          {` · ${fechaDe(reporte.fecha)}`}
          {reporte.detalle && `: ${reporte.detalle}`}
        </p>
      )}

      {respuesta && !editando && (
        <div className="mt-3 rounded-control bg-surface px-4 py-3">
          <p className="text-label font-semibold text-primary-dark">
            Respuesta de {negocio.nombre} · {fechaDe(respuesta.fecha)}
            {respuesta.editada && " · editada"}
          </p>
          <p className="mt-1 text-body whitespace-pre-line text-ink">{respuesta.texto}</p>
          {resena.editada_despues_de_respuesta && (
            <p className="mt-1 text-label text-warning-ink">
              El cliente editó su reseña después de tu respuesta.
            </p>
          )}
        </div>
      )}
      {puedeResponder && !retirada && (editando || !respuesta) && (
        <FormRespuesta
          key={editando ? "editar" : "nueva"}
          idResena={resena.id_resena}
          inicial={editando ? respuesta?.texto : undefined}
          onListo={() => setEditando(false)}
        />
      )}

      <ConfirmDialog
        abierto={confirmarBorrar}
        onAbiertoChange={setConfirmarBorrar}
        titulo="¿Borrar la respuesta?"
        descripcion="Dejará de verse en la app y en el perfil del negocio. Si respondes otra vez, el cliente no recibe un aviso nuevo."
        confirmar="Borrar respuesta"
        peligro
        cargando={borrar.isPending}
        onConfirmar={() => borrar.mutate(resena.id_resena, { onSettled: () => setConfirmarBorrar(false) })}
      />
    </Card>
  );
}
