import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { BellRing } from "lucide-react";
import { useId } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { hoyISO, parseFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MAX_INDICACIONES } from "../schemas";
import { conPunto, sinSaltos } from "../textos";

const AVISO_LARGO = 450;

/**
 * D2 · Indicaciones previas (hasta 500 caracteres, un solo párrafo) y su vista previa: el
 * recordatorio del día anterior tal como lo arma la API (app y correo; no la push).
 */
export function IndicacionesPrevias({
  valor,
  onChange,
  onBlur,
  error,
  disabled,
  servicio,
  negocio,
}: {
  valor: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  error?: string;
  disabled: boolean;
  servicio: string;
  negocio: string;
}) {
  const id = useId();
  const texto = valor.trim();
  return (
    <Card className="p-5">
      <h3 className="text-card font-semibold text-ink">
        <label htmlFor={id}>Indicaciones previas</label>
      </h3>
      <p className="mt-0.5 text-label text-muted">
        Se muestran al reservar y en el recordatorio de la noche anterior.
      </p>
      <Textarea
        id={id}
        className="mt-3"
        rows={3}
        maxLength={MAX_INDICACIONES}
        placeholder="Ejemplo: ayuno de 8 horas (agua sí). Trae el carnet de vacunas."
        value={valor}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-contador`}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        onChange={(e) => onChange(sinSaltos(e.target.value))}
        onBlur={onBlur}
      />
      <div id={`${id}-contador`} className="mt-1 flex justify-between gap-3 text-label">
        <span className={error ? "text-danger" : "text-muted"}>
          {error ?? "Un solo párrafo, sin saltos de línea."}
        </span>
        <span className={cn("tabular-nums", valor.length >= AVISO_LARGO ? "text-warning-ink" : "text-muted")}>
          {valor.length} / {MAX_INDICACIONES}
        </span>
      </div>

      <div className="mt-4 rounded-control bg-surface p-3">
        <p className="flex items-center gap-1.5 text-label font-semibold text-muted">
          <BellRing className="size-3.5" aria-hidden /> Así lo verá el cliente
        </p>
        {texto ? (
          <p className="mt-1.5 text-body text-ink" data-testid="vista-previa-indicaciones">
            Mañana, {fechaManana()} a las 9:00 a. m., Max tiene {servicio.trim() || "este servicio"} en{" "}
            {negocio}. <strong>Indicaciones del negocio: {conPunto(texto)}</strong> Si no puedes asistir,
            cancela o reprograma desde la app.
          </p>
        ) : (
          <p className="mt-1.5 text-body text-muted">Escribe las indicaciones para ver cómo le llegan.</p>
        )}
        <p className="mt-1.5 text-label text-subtle">
          Ejemplo con una mascota de muestra. Van en el recordatorio de la app y en el correo, no en la
          notificación push.
        </p>
      </div>
    </Card>
  );
}

/** "lunes, 5 de octubre" (mañana en Bogotá), como el recordatorio. */
const fechaManana = () => format(addDays(parseFecha(hoyISO()), 1), "EEEE, d 'de' MMMM", { locale: es });
