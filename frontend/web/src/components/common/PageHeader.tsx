import type { ReactNode } from "react";

/** Encabezado dentro del contenido de una sección: título, descripción y acciones. */
export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-title font-bold text-ink">{titulo}</h2>
        {descripcion && <p className="mt-1 text-body text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </div>
  );
}
