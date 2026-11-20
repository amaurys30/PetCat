import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { CalendarX } from "lucide-react-native";
import { View } from "react-native";

import { getNegocio } from "@/api/negocios";
import { EmptyState, ErrorState, ScreenHeader, SkeletonLista } from "@/components/ui";
import { queryKeys } from "@/lib/queryKeys";

import { FormularioAgenda } from "./FormularioAgenda";
import { useCita } from "./hooks";
import { HORAS_AVISO, puedeReprogramar } from "./logica";

/** `/cita/[id]/reprogramar`: la misma pantalla de agendar, con servicio, mascota y sede de la cita. */
export function ReprogramarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cita = useCita(Number(id));
  const id_negocio = cita.data?.negocio.id_negocio ?? 0;
  const negocio = useQuery({
    queryKey: queryKeys.negocios.perfil(id_negocio),
    queryFn: () => getNegocio(id_negocio),
    enabled: id_negocio > 0,
  });
  const volverA = `/cita/${id}` as const;

  if (cita.isPending || (cita.data && negocio.isPending)) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader titulo="Reprogramar cita" volverA={volverA} />
        <SkeletonLista filas={4} etiqueta="Cargando" />
      </View>
    );
  }
  if (!cita.data || !negocio.data) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader titulo="Reprogramar cita" volverA={volverA} />
        <ErrorState
          error={cita.error ?? negocio.error}
          onReintentar={() => void (cita.data ? negocio.refetch() : cita.refetch())}
        />
      </View>
    );
  }
  if (!puedeReprogramar(cita.data)) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader titulo="Reprogramar cita" volverA={volverA} />
        <EmptyState
          icono={CalendarX}
          titulo="Esta cita ya no se puede reprogramar"
          descripcion={`Solo se reprograman citas pendientes o confirmadas, hasta ${HORAS_AVISO} horas antes.`}
        />
      </View>
    );
  }
  return <FormularioAgenda negocio={negocio.data} reprogramar={cita.data} />;
}
