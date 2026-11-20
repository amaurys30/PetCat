import { Pill, Stethoscope, Syringe, type LucideIcon } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import type { EventoSalud } from "@/api/types";
import { Text } from "@/components/ui";
import { formatearFecha } from "@/lib/formatos";
import { textoPlazo, tituloEvento } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

const ESTILO: Record<string, { caja: string; color: string; icono: LucideIcon }> = {
  vacuna: { caja: "bg-sun-soft", color: colors["sun-ink"], icono: Syringe },
  desparasitacion: { caja: "bg-lavender-soft", color: colors["lavender-ink"], icono: Pill },
  control: { caja: "bg-info-soft", color: colors["info-ink"], icono: Stethoscope },
};

/** Próximos eventos de salud (vacunas, desparasitaciones y controles), de la API. */
export function Recordatorios({ eventos }: { eventos: EventoSalud[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-pantalla">
      {eventos.map((e) => {
        const estilo = ESTILO[e.tipo] ?? ESTILO.control!;
        const Icono = estilo.icono;
        const vencido = e.dias < 0;
        const plazo = textoPlazo(e.dias);
        return (
          <View
            key={`${e.tipo}-${e.id_vacuna ?? e.id_historial}`}
            accessible
            accessibilityLabel={`${tituloEvento(e)}. ${plazo}, ${formatearFecha(e.fecha)}.`}
            className={`w-48 gap-2 rounded-card p-4 ${vencido ? "bg-danger-soft" : estilo.caja}`}
          >
            <Icono size={24} color={vencido ? colors["danger-ink"] : estilo.color} />
            <Text variante="cuerpoMedio" className="font-bold" numberOfLines={2}>
              {tituloEvento(e)}
            </Text>
            <Text variante="apoyo" className={vencido ? "font-bold text-danger-ink" : "text-ink"}>
              {plazo}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
