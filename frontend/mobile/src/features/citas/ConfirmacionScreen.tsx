import { useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { conPunto } from "@/features/explorar/logica";
import { Avatar, Button, ErrorState, SkeletonLista, Text } from "@/components/ui";
import { formatearDinero, formatearFecha, formatearHora } from "@/lib/formatos";
import { colors } from "@/theme/tokens";

import { Confeti } from "./components/Confeti";
import { useCita } from "./hooks";
import { capitalizar, HORAS_AVISO } from "./logica";

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text variante="apoyo" className="font-semibold uppercase text-muted">
        {rotulo}
      </Text>
      <Text className="font-bold">{valor}</Text>
    </View>
  );
}

/**
 * M13 · Cita agendada (o reprogramada). La cita llega de la respuesta de la reserva (caché) o
 * de GET /citas/{id}. Si el negocio debe confirmarla, lo dice. Sin "Añadir al calendario" en M5.
 */
export function ConfirmacionScreen() {
  const { id, reprogramada } = useLocalSearchParams<{ id: string; reprogramada?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cita = useCita(Number(id));
  const c = cita.data;

  if (!c) {
    return (
      <View className="flex-1 justify-center bg-surface" style={{ paddingTop: insets.top }}>
        {cita.isPending ? (
          <SkeletonLista filas={2} etiqueta="Cargando la cita" />
        ) : (
          <ErrorState error={cita.error} onReintentar={() => cita.refetch()} reintentando={cita.isFetching} />
        )}
        <Button
          titulo="Ver mis citas"
          variante="secundario"
          onPress={() => router.replace("/citas")}
          className="mx-pantalla"
        />
      </View>
    );
  }

  const pendiente = c.estado === "pendiente";
  const titulo = reprogramada ? "¡Cita reprogramada!" : pendiente ? "¡Solicitud enviada!" : "¡Cita agendada!";
  const detalle = pendiente
    ? `${c.negocio.nombre} debe confirmarla. Verás el estado en Mis citas.`
    : "Quedó confirmada. La encuentras en Mis citas.";
  const fecha = capitalizar(formatearFecha(c.fecha));
  const hora = formatearHora(c.hora_inicio);
  const valor = formatearDinero(c.precio_estimado);

  return (
    <View className="flex-1 bg-primary-soft">
      <ScrollView
        contentContainerClassName="items-stretch gap-6 px-pantalla pb-6"
        contentContainerStyle={{ paddingTop: insets.top + 40 }}
      >
        <View className="items-center gap-3">
          <View className="h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary-strong">
            <Check size={48} color={colors.white} strokeWidth={3} accessibilityElementsHidden />
          </View>
          <Text variante="hero" className="text-center" accessibilityRole="header">
            {titulo}
          </Text>
          <Text className="text-center text-muted">{detalle}</Text>
        </View>

        <View
          accessible
          accessibilityLabel={`${c.mascota.nombre}, ${c.servicio.nombre}, en ${c.negocio.nombre}. Fecha: ${fecha}. Hora: ${conPunto(hora)} Valor: ${valor}.`}
          className="gap-4 rounded-card bg-white p-5"
        >
          <View className="flex-row items-center gap-3">
            <Avatar nombre={c.mascota.nombre} especie={c.mascota.especie} />
            <View className="flex-1 gap-0.5">
              <Text
                variante="cuerpoMedio"
                className="font-bold"
              >{`${c.mascota.nombre} · ${c.servicio.nombre}`}</Text>
              <Text variante="apoyo" className="text-muted">
                {c.sucursal ? `${c.negocio.nombre}, ${c.sucursal.nombre}` : c.negocio.nombre}
              </Text>
            </View>
          </View>
          <View className="border-t border-dashed border-border" />
          <View className="flex-row gap-3">
            <Dato rotulo="Fecha" valor={fecha} />
            <Dato rotulo="Hora" valor={hora} />
            <Dato rotulo="Valor" valor={valor} />
          </View>
        </View>

        <View className="gap-2 rounded-card bg-sun-soft p-5">
          <Text className="font-bold text-sun-ink" accessibilityRole="header">
            Para el día de la cita
          </Text>
          {[
            `El pasaporte de ${c.mascota.nombre} está en tu app: muéstralo en recepción.`,
            "Llega 10 minutos antes.",
            `¿No puedes ir? Cancela con al menos ${HORAS_AVISO} horas de anticipación.`,
          ].map((t) => (
            <Text key={t} variante="apoyo" className="text-sun-ink">{`•  ${t}`}</Text>
          ))}
        </View>
      </ScrollView>

      <View className="gap-3 px-pantalla pt-2" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Button titulo="Ver mis citas" onPress={() => router.replace("/citas")} />
        <Button titulo="Ir al inicio" variante="secundario" onPress={() => router.replace("/")} />
      </View>
      <Confeti />
    </View>
  );
}
