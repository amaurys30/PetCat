import type { UsoLimite } from "@/api/types";
import { cn } from "@/lib/utils";

/**
 * Uso de un límite del plan: "26 de 30" con su barra, o "4 · ilimitado" sin barra.
 * Con `avisar`, la barra se pone amarilla desde el 80 % y roja al llegar al límite.
 */
export function BarraUso({
  etiqueta,
  uso,
  avisar = true,
}: {
  etiqueta: string;
  uso: UsoLimite;
  avisar?: boolean;
}) {
  const ilimitado = uso.maximo === -1;
  const porcentaje = ilimitado ? 0 : Math.min(100, Math.round((uso.usadas / Math.max(uso.maximo, 1)) * 100));
  const lleno = avisar && !ilimitado && uso.usadas >= uso.maximo;
  const alto = avisar && !ilimitado && porcentaje >= 80;
  return (
    <div>
      <div className="flex justify-between gap-3 text-body">
        <span className="text-muted">{etiqueta}</span>
        <span
          className={cn(
            "shrink-0 font-semibold",
            lleno ? "text-danger" : alto ? "text-warning-ink" : "text-ink",
          )}
        >
          {ilimitado ? `${uso.usadas} · ilimitado` : `${uso.usadas} de ${uso.maximo}`}
        </span>
      </div>
      {!ilimitado && (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-label={etiqueta}
          aria-valuemin={0}
          aria-valuemax={uso.maximo}
          aria-valuenow={uso.usadas}
        >
          <div
            className={cn("h-full rounded-full", lleno ? "bg-danger" : alto ? "bg-warning" : "bg-primary")}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      )}
    </div>
  );
}
