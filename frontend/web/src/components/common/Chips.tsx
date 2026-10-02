import { cn } from "@/lib/utils";

export interface Chip<T extends string> {
  valor: T;
  texto: string;
  contador?: number;
}

/** Filtros rápidos de una sola selección (Todas · Pendientes · Confirmadas...). */
export function Chips<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: Chip<T>[];
  valor: T;
  onChange: (valor: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onChange(opcion.valor)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body font-medium transition-colors",
              activa
                ? "border-primary bg-primary-soft text-primary-dark"
                : "bg-white text-muted hover:text-ink",
            )}
          >
            {opcion.texto}
            {opcion.contador !== undefined && (
              <span className="text-label opacity-80">{opcion.contador}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
