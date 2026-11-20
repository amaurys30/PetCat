import { View } from "react-native";

import type { CitaResumen } from "@/api/types";
import { Card, Text } from "@/components/ui";
import { parsearFechaApi } from "@/lib/fechas";
import { formatearFecha, formatearHora } from "@/lib/formatos";

import { ChipDato } from "./ChipSalud";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const ESTADOS: Record<string, string> = { pendiente: "Pendiente", confirmada: "Confirmada" };

/**
 * Próxima cita en Inicio. Todavía no se abre (el detalle y "Mis citas" llegan en M5): es un
 * solo elemento para el lector, con toda la información en su etiqueta.
 */
export function TarjetaProximaCita({ cita, mascota }: { cita: CitaResumen; mascota: string }) {
  const fecha = parsearFechaApi(cita.fecha);
  const [diaSemana] = formatearFecha(cita.fecha).split(" ");
  const hora = formatearHora(cita.hora_inicio);
  const estado = ESTADOS[cita.estado] ?? cita.estado;
  const etiqueta = `${cita.servicio.nombre} para ${mascota}, ${formatearFecha(cita.fecha)} a las ${hora}, en ${cita.negocio.nombre}. ${estado}.`;

  return (
    <Card className="flex-row items-center gap-4">
      <View accessible accessibilityLabel={etiqueta} className="flex-1 flex-row items-center gap-4">
        <View className="w-16 items-center rounded-control bg-coral-soft py-2">
          <Text variante="apoyo" className="font-bold uppercase text-coral-dark">
            {diaSemana}
          </Text>
          <Text variante="titulo">{fecha.dia}</Text>
          <Text variante="apoyo" className="text-muted">
            {MESES[fecha.mes - 1]}
          </Text>
        </View>
        <View className="flex-1 gap-1.5">
          <Text variante="cuerpoMedio" className="font-bold">
            {cita.servicio.nombre}
          </Text>
          <Text variante="apoyo" className="text-muted">
            {cita.negocio.nombre} · {hora}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipDato texto={estado} tono={cita.estado === "confirmada" ? "info" : "coral"} />
            <ChipDato texto={mascota} />
          </View>
        </View>
      </View>
    </Card>
  );
}
