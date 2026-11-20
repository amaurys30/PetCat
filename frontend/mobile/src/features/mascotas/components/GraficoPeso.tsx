import { TrendingDown, TrendingUp, Minus } from "lucide-react-native";
import { View } from "react-native";

import type { PuntoPeso } from "@/api/types";
import { Card, ErrorState, Skeleton, Text } from "@/components/ui";
import { parsearFechaApi } from "@/lib/fechas";
import { describirPeso } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MAX_BARRAS = 6;
const ALTO = 96;

/** Último peso de cada mes, de los últimos 6 meses con registro. */
export function barrasPorMes(puntos: PuntoPeso[]) {
  const porMes = new Map<string, { etiqueta: string; peso: number }>();
  for (const p of puntos) {
    const { anio, mes } = parsearFechaApi(p.fecha);
    porMes.set(`${anio}-${mes}`, { etiqueta: MESES[mes - 1]!, peso: p.peso });
  }
  return [...porMes.values()].slice(-MAX_BARRAS);
}

type Props = { puntos: PuntoPeso[] | undefined; cargando: boolean; error: unknown; onReintentar: () => void };

/**
 * Peso de los últimos meses. Las barras son decorativas: la tarjeta es un solo elemento con la
 * descripción en texto ("Subió 0,6 kg en 3 meses, de 27,8 a 28,4 kg…"). Si falla, el error se
 * muestra solo aquí, no en toda la ficha.
 */
export function GraficoPeso({ puntos, cargando, error, onReintentar }: Props) {
  if (cargando) {
    return (
      <Card>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando el peso">
          <Skeleton className="h-32 w-full" />
        </View>
      </Card>
    );
  }
  if (error && !puntos) {
    return (
      <Card>
        <ErrorState error={error} titulo="No pudimos cargar el peso" onReintentar={onReintentar} />
      </Card>
    );
  }
  const lista = puntos ?? [];
  const { titulo, descripcion } = describirPeso(lista);
  const barras = barrasPorMes(lista);
  const min = Math.min(...barras.map((b) => b.peso));
  const max = Math.max(...barras.map((b) => b.peso));
  const subio = lista.length > 1 && lista[lista.length - 1]!.peso > lista[0]!.peso;
  const bajo = lista.length > 1 && lista[lista.length - 1]!.peso < lista[0]!.peso;
  const Tendencia = subio ? TrendingUp : bajo ? TrendingDown : Minus;

  return (
    <Card>
      <View accessible accessibilityLabel={`Peso. ${descripcion}`} className="gap-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text variante="seccion">Peso</Text>
          {titulo && (
            <View className="flex-row items-center gap-1 rounded-full bg-primary-soft px-3 py-1">
              <Tendencia size={16} color={colors["primary-deep"]} />
              <Text variante="apoyo" className="font-bold text-primary-deep">
                {titulo}
              </Text>
            </View>
          )}
        </View>
        {barras.length === 0 ? (
          <Text className="text-muted">{descripcion}</Text>
        ) : (
          <>
            <View className="flex-row items-end gap-3" style={{ height: ALTO }}>
              {barras.map((b, i) => {
                // Altura entre 30 % y 100 % según el rango, para que la diferencia se vea.
                const alto = max === min ? ALTO * 0.7 : ALTO * (0.3 + (0.7 * (b.peso - min)) / (max - min));
                return (
                  <View
                    key={`${b.etiqueta}-${i}`}
                    className={`flex-1 rounded-lg ${i === barras.length - 1 ? "bg-primary-strong" : "bg-primary-soft"}`}
                    style={{ height: alto }}
                  />
                );
              })}
            </View>
            <View className="flex-row gap-3">
              {barras.map((b, i) => (
                <Text key={`${b.etiqueta}-${i}`} variante="apoyo" className="flex-1 text-center text-muted" maxFontSizeMultiplier={1.3}>
                  {b.etiqueta}
                </Text>
              ))}
            </View>
            <Text variante="apoyo" className="text-muted">
              {descripcion}
            </Text>
          </>
        )}
      </View>
    </Card>
  );
}
