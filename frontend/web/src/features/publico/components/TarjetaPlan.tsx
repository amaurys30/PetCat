import { Check } from "lucide-react";
import { Link } from "react-router";
import type { Plan } from "@/api/negocios";
import { ventajasPlan } from "@/features/suscripcion/textos";
import { dinero } from "@/lib/format";
import { cn } from "@/lib/utils";
import { botonPrimario, botonSecundario } from "../estilos";

/** Tarjeta de un plan con su precio en COP, límites y características reales. */
export function TarjetaPlan({
  plan,
  anterior,
  destacado,
  diasPrueba,
  accion,
}: {
  plan: Plan;
  anterior?: Plan;
  destacado: boolean;
  diasPrueba: number | null;
  accion: { to: string; texto: string; externo?: boolean };
}) {
  const gratis = plan.precio_mensual === 0;
  return (
    <li
      className={cn(
        "relative flex flex-col gap-5 rounded-modal border bg-white p-7",
        destacado
          ? "border-2 border-primary-dark shadow-[0_16px_40px_rgb(13_127_120/0.16)]"
          : "border-border",
      )}
    >
      {destacado && diasPrueba && (
        <p className="absolute -top-3.5 left-7 rounded-full bg-primary-dark px-3 py-1 text-[13px] font-semibold text-white">
          Prueba gratis de {diasPrueba} días
        </p>
      )}
      <div>
        <h3 className="text-[22px] font-bold text-ink">{plan.nombre}</h3>
        {plan.descripcion && <p className="mt-2 text-[15px] leading-6 text-muted">{plan.descripcion}</p>}
      </div>
      <div>
        <p className="flex items-baseline gap-1 text-ink">
          <span className="text-[34px] leading-10 font-bold">
            {gratis ? "Gratis" : dinero(plan.precio_mensual)}
          </span>
          {!gratis && <span className="text-[15px] text-muted">/mes</span>}
        </p>
        <p className="mt-1 text-[14px] text-muted">
          {gratis
            ? "Sin tiempo límite"
            : plan.precio_anual > 0
              ? `o ${dinero(plan.precio_anual)} al año`
              : "Pago mensual"}
        </p>
      </div>
      <ul className="flex flex-1 flex-col gap-3">
        {ventajasPlan(plan, anterior).map((v) => (
          <li key={v} className="flex items-start gap-2.5 text-[15px] leading-6 text-ink">
            <Check className="mt-0.5 size-5 shrink-0 text-primary-dark" aria-hidden />
            {v}
          </li>
        ))}
      </ul>
      {accion.externo ? (
        <a href={accion.to} className={destacado ? botonPrimario : botonSecundario}>
          {accion.texto}
        </a>
      ) : (
        <Link to={accion.to} className={destacado ? botonPrimario : botonSecundario}>
          {accion.texto}
        </Link>
      )}
    </li>
  );
}
