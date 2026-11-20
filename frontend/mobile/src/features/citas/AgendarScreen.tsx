import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { getNegocio } from "@/api/negocios";
import { Button, ErrorState, ScreenHeader, SkeletonLista } from "@/components/ui";
import { useMascotas } from "@/features/mascotas/hooks";
import { RESPALDO, useVolver } from "@/lib/navegacion";
import { queryKeys } from "@/lib/queryKeys";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";

import { FormularioAgenda } from "./FormularioAgenda";

/** `/negocios/[id]/agendar?servicio=`: desde el perfil del negocio y desde el mapa. */
export function AgendarScreen() {
  const { id, servicio } = useLocalSearchParams<{ id: string; servicio?: string }>();
  const id_negocio = Number(id);
  const volver = useVolver(RESPALDO.inicio);
  const negocio = useQuery({
    queryKey: queryKeys.negocios.perfil(id_negocio),
    queryFn: () => getNegocio(id_negocio),
  });
  const mascotas = useMascotas();
  const preferida = useMascotaSeleccionada((s) => s.id_mascota);

  if (negocio.isPending || mascotas.isPending) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader titulo="Agendar cita" volverA={RESPALDO.inicio} />
        <SkeletonLista filas={4} etiqueta="Cargando" />
      </View>
    );
  }
  if (!negocio.data || !mascotas.data) {
    const error = negocio.error ?? mascotas.error;
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader titulo="Agendar cita" volverA={RESPALDO.inicio} />
        <ErrorState
          error={error}
          onReintentar={() => {
            void negocio.refetch();
            void mascotas.refetch();
          }}
          reintentando={negocio.isFetching || mascotas.isFetching}
        />
        <Button titulo="Volver" variante="secundario" onPress={volver} className="mx-pantalla" />
      </View>
    );
  }
  return (
    <FormularioAgenda
      negocio={negocio.data}
      mascotas={mascotas.data}
      mascotaPreferida={preferida}
      servicioInicial={servicio ? Number(servicio) : undefined}
    />
  );
}
