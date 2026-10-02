import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type Row } from "@tanstack/react-table";
import type { KeyboardEvent, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Tabla base del panel. La paginación, el orden y los filtros van del lado de la API:
 * esta tabla solo pinta filas, el esqueleto de carga y el estado vacío.
 */
export function DataTable<T>({
  columnas,
  datos,
  cargando,
  vacio,
  alSeleccionar,
  seleccionada,
  idFila,
}: {
  columnas: ColumnDef<T, unknown>[];
  datos: T[] | undefined;
  cargando?: boolean;
  vacio?: ReactNode;
  alSeleccionar?: (fila: T) => void;
  seleccionada?: string | number | null;
  idFila?: (fila: T) => string | number;
}) {
  // TanStack Table devuelve funciones que no se pueden memorizar; el compilador de React lo sabe.
  // eslint-disable-next-line react-hooks/incompatible-library
  const tabla = useReactTable({
    data: datos ?? [],
    columns: columnas,
    getCoreRowModel: getCoreRowModel(),
    getRowId: idFila ? (fila) => String(idFila(fila)) : undefined,
  });

  const filas = tabla.getRowModel().rows;
  const clickable = Boolean(alSeleccionar);

  const alTeclear = (e: KeyboardEvent, fila: Row<T>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      alSeleccionar?.(fila.original);
    }
  };

  return (
    <div className="overflow-hidden rounded-card border bg-white">
      <table className="w-full text-left text-body">
        <thead className="bg-track text-label font-semibold text-muted uppercase">
          {tabla.getHeaderGroups().map((grupo) => (
            <tr key={grupo.id}>
              {grupo.headers.map((h) => (
                <th key={h.id} scope="col" className="px-4 py-2.5 font-semibold">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {cargando
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-t">
                  {columnas.map((_c, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <Skeleton className="h-3 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : filas.map((fila) => (
                <tr
                  key={fila.id}
                  className={cn(
                    "border-t transition-colors",
                    clickable && "cursor-pointer hover:bg-surface",
                    seleccionada !== undefined && fila.id === String(seleccionada) && "bg-selected",
                  )}
                  onClick={clickable ? () => alSeleccionar?.(fila.original) : undefined}
                  onKeyDown={clickable ? (e) => alTeclear(e, fila) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                >
                  {fila.getVisibleCells().map((celda) => (
                    <td key={celda.id} className="px-4 py-3">
                      {flexRender(celda.column.columnDef.cell, celda.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!cargando && filas.length === 0 && vacio}
    </div>
  );
}
