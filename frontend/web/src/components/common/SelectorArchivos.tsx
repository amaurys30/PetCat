import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const tamano = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/**
 * Zona para arrastrar o elegir archivos privados (historial médico, comprobantes). No sube
 * nada: entrega los archivos válidos con `onAgregar` y los problemas (formato, tamaño, cupo)
 * con `onProblemas`. `cupo` es cuántos más se pueden agregar.
 */
export function SelectorArchivos({
  pendientes,
  cupo,
  validar,
  onAgregar,
  onQuitar,
  onProblemas,
  texto = "Arrastra archivos o haz clic para subir",
  ayuda = "JPG, PNG, WebP o PDF · hasta 10 MB · privados, con enlace temporal",
  multiple = true,
  deshabilitado = false,
}: {
  pendientes: File[];
  cupo: number;
  validar: (archivo: File) => string | null;
  onAgregar: (archivos: File[]) => void;
  onQuitar: (indice: number) => void;
  onProblemas: (problemas: string[]) => void;
  texto?: string;
  ayuda?: string;
  multiple?: boolean;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const lleno = cupo <= 0;

  const recibir = (lista: FileList | null) => {
    if (!lista) return;
    const problemas: string[] = [];
    const validos: File[] = [];
    for (const archivo of Array.from(lista)) {
      const problema = validar(archivo);
      if (problema) problemas.push(problema);
      else validos.push(archivo);
    }
    if (validos.length > cupo) {
      problemas.push(
        cupo === 0
          ? "Ya no caben más archivos"
          : `Solo caben ${cupo} ${cupo === 1 ? "archivo más" : "archivos más"}: se agregaron los primeros`,
      );
    }
    onProblemas(problemas);
    if (validos.length > 0 && cupo > 0) onAgregar(validos.slice(0, cupo));
    if (input.current) input.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (!deshabilitado && !lleno) recibir(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-card border border-dashed bg-surface px-4 py-4 text-center transition-colors",
          encima && "border-primary bg-selected",
          (deshabilitado || lleno) && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="flex items-center gap-1.5 text-body font-semibold text-primary">
          <Paperclip className="size-4" aria-hidden />
          {lleno ? "Ya no caben más archivos" : texto}
        </span>
        <span className="text-label text-muted">{ayuda}</span>
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={deshabilitado || lleno}
          onChange={(e) => recibir(e.target.files)}
        />
      </label>
      {pendientes.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Archivos por subir">
          {pendientes.map((archivo, i) => {
            const Icono = archivo.type === "application/pdf" ? FileText : ImageIcon;
            return (
              <li
                key={`${archivo.name}-${i}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-white pr-1 pl-3 text-label text-ink"
              >
                <Icono className="size-3.5" aria-hidden />
                {archivo.name} · {tamano(archivo.size)}
                <button
                  type="button"
                  aria-label={`Quitar ${archivo.name}`}
                  onClick={() => onQuitar(i)}
                  className="rounded-full p-1 text-muted hover:bg-surface hover:text-danger"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
