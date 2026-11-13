import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { ResumenSalud } from "@/api/salud";
import { Badge } from "@/components/ui/badge";
import { textoPeso } from "@/features/agenda/textos";
import { fechaCorta, parseFecha } from "@/lib/format";

type Evolucion = ResumenSalud["evolucion_peso"];

const TENDENCIA = {
  sube: { icono: ArrowUp, tono: "warning" },
  baja: { icono: ArrowDown, tono: "info" },
  estable: { icono: ArrowRight, tono: "neutral" },
} as const;

const mes = (fecha: string) => format(parseFecha(fecha), "MMM", { locale: es }).replace(".", "");

/**
 * Tarjeta de peso: barras de los pesos del historial (24 meses), la última más oscura (el
 * peso actual), con la variación y la tendencia. Tooltip por barra y la misma información
 * como tabla para lectores de pantalla.
 */
export function GraficoPeso({ evolucion }: { evolucion: Evolucion }) {
  const { puntos, tendencia, variacion_pct, peso_actual } = evolucion;
  const t = tendencia ? TENDENCIA[tendencia] : null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2">
        <p className="text-label text-muted">Peso</p>
        {t && variacion_pct !== null && (
          <Badge tono={t.tono}>
            <t.icono className="size-3" aria-hidden />
            {`${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Math.abs(variacion_pct))} % · ${tendencia}`}
          </Badge>
        )}
      </div>
      {puntos.length < 2 ? (
        <>
          <p className="mt-1 text-title font-bold text-ink">{textoPeso(peso_actual) ?? "—"}</p>
          <p className="text-label text-muted">
            {puntos.length === 0 ? "Sin pesos en el historial" : "Un solo peso en el historial"}
          </p>
        </>
      ) : (
        <>
          <div className="mt-2 h-20 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={puntos}
                margin={{ top: 2, right: 4, bottom: 0, left: 4 }}
                barCategoryGap={2}
                accessibilityLayer={false}
              >
                <XAxis
                  dataKey="fecha"
                  tickFormatter={mes}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 10, fill: "var(--color-subtle)" }}
                  height={18}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-track)" }}
                  separator=": "
                  formatter={(valor) => [textoPeso(Number(valor)), "Peso"]}
                  labelFormatter={(fecha) => fechaCorta(String(fecha))}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="peso" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                  {puntos.map((p, i) => (
                    <Cell
                      key={p.fecha}
                      fill={i === puntos.length - 1 ? "var(--color-primary-dark)" : "var(--color-primary)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Pesos del historial</caption>
            <tbody>
              {puntos.map((p) => (
                <tr key={p.fecha}>
                  <td>{fechaCorta(p.fecha)}</td>
                  <td>{textoPeso(p.peso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
