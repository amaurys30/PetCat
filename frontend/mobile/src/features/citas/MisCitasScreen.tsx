import { useRouter } from "expo-router";
import { CalendarDays, History } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import type { AlcanceCitas } from "@/api/citas";
import {
  Button,
  EmptyState,
  ErrorState,
  ScreenHeader,
  Segmented,
  SkeletonLista,
  Text,
} from "@/components/ui";
import { hoyEnBogota } from "@/lib/fechas";
import { colors } from "@/theme/tokens";

import { useCancelarConConfirmacion } from "./acciones";
import { TarjetaCita } from "./components/TarjetaCita";
import { useMisCitas, useRefrescarAlVolver } from "./hooks";
import { agruparCitas } from "./logica";

/**
 * M17 · Mis citas (pestaña Citas): próximas y pasadas, agrupadas por semana o mes. Sin tiempo
 * real en M5: se pide de nuevo al volver a la pestaña y al deslizar hacia abajo.
 */
export function MisCitasScreen() {
  const router = useRouter();
  const [alcance, setAlcance] = useState<AlcanceCitas>("proximas");
  const citas = useMisCitas(alcance);
  const { pedir, cancelando } = useCancelarConConfirmacion();
  const [refrescando, setRefrescando] = useState(false);

  useRefrescarAlVolver(citas.refetch);

  const refrescar = async () => {
    setRefrescando(true);
    try {
      await citas.refetch();
    } finally {
      setRefrescando(false);
    }
  };

  const lista = citas.data?.pages.flatMap((p) => p.citas) ?? [];
  const grupos = agruparCitas(lista, hoyEnBogota());

  let contenido;
  if (citas.isPending) contenido = <SkeletonLista filas={3} etiqueta="Cargando tus citas" />;
  else if (citas.isError && lista.length === 0)
    contenido = (
      <ErrorState error={citas.error} onReintentar={() => citas.refetch()} reintentando={citas.isFetching} />
    );
  else if (lista.length === 0)
    contenido =
      alcance === "proximas" ? (
        <EmptyState
          icono={CalendarDays}
          titulo="No tienes citas próximas"
          descripcion="Busca una veterinaria o peluquería y agenda en pocos pasos."
          accion={{ etiqueta: "Explorar negocios", onPress: () => router.navigate("/explorar") }}
        />
      ) : (
        <EmptyState icono={History} titulo="Aún no tienes citas pasadas" />
      );
  else
    contenido = (
      <View className="gap-6 px-pantalla">
        {grupos.map((g) => (
          <View key={g.titulo} className="gap-3">
            <Text variante="apoyo" accessibilityRole="header" className="font-bold uppercase text-muted">
              {g.titulo}
            </Text>
            {g.citas.map((c) => (
              <TarjetaCita
                key={c.id_cita}
                cita={c}
                onCancelar={pedir}
                cancelando={cancelando === c.id_cita}
              />
            ))}
          </View>
        ))}
        {citas.hasNextPage && (
          <Button
            titulo="Cargar más"
            variante="secundario"
            cargando={citas.isFetchingNextPage}
            onPress={() => citas.fetchNextPage()}
          />
        )}
      </View>
    );

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Mis citas" />
      <ScrollView
        contentContainerClassName="gap-5 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            colors={[colors["primary-strong"]]}
            tintColor={colors["primary-strong"]}
          />
        }
      >
        <Segmented
          etiqueta="Ver citas"
          valor={alcance}
          onCambiar={setAlcance}
          opciones={[
            { valor: "proximas", etiqueta: "Próximas" },
            { valor: "pasadas", etiqueta: "Pasadas" },
          ]}
          className="mx-pantalla"
        />
        {contenido}
      </ScrollView>
    </View>
  );
}
