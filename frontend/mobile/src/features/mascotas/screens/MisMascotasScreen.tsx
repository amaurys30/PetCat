import { useRouter } from "expo-router";
import { PawPrint, Plus } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState, ErrorState, ScreenHeader, SkeletonLista, Text } from "@/components/ui";
import { RESPALDO } from "@/lib/navegacion";
import { useIdUsuario } from "@/store/sesion";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
import { colors } from "@/theme/tokens";

import { AvisoSinConexion } from "../components/AvisoSinConexion";
import { TarjetaMascota } from "../components/TarjetaMascota";
import { useMascotas, useSoloLectura } from "../hooks";

/** M5 · Mis mascotas: vivas primero y las fallecidas al final ("En memoria"), como las da la API. */
export function MisMascotasScreen() {
  const router = useRouter();
  const mascotas = useMascotas();
  const soloLectura = useSoloLectura();
  const id_usuario = useIdUsuario();
  const seleccionar = useMascotaSeleccionada((s) => s.seleccionar);

  const abrirCarnet = (id_mascota: number) => {
    if (id_usuario) seleccionar(id_usuario, id_mascota);
    router.navigate("/carnet");
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Mis mascotas" subtitulo="Toca una mascota para ver su ficha completa." volverA={RESPALDO.inicio} />
      <AvisoSinConexion />
      {mascotas.isPending ? (
        <SkeletonLista filas={2} etiqueta="Cargando tus mascotas" />
      ) : mascotas.isError && !mascotas.data ? (
        <ErrorState error={mascotas.error} onReintentar={() => mascotas.refetch()} reintentando={mascotas.isFetching} />
      ) : mascotas.data.length === 0 ? (
        <EmptyState
          icono={PawPrint}
          titulo="Aún no tienes mascotas"
          descripcion="Agrégala y lleva su salud al día desde aquí."
          accion={soloLectura ? undefined : { etiqueta: "Agregar mascota", onPress: () => router.push("/mascotas/nueva") }}
        />
      ) : (
        <ScrollView contentContainerClassName="gap-4 px-pantalla pb-10">
          {/* Las que están "En memoria" van al final. */}
          {[...mascotas.data].sort((a, b) => Number(a.fallecido) - Number(b.fallecido)).map((m) => (
            <TarjetaMascota
              key={m.id_mascota}
              mascota={m}
              onAbrir={() => router.push(`/mascotas/${m.id_mascota}`)}
              onCarnet={() => abrirCarnet(m.id_mascota)}
            />
          ))}
          {!soloLectura && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Agregar otra mascota"
              onPress={() => router.push("/mascotas/nueva")}
              className="items-center gap-1 rounded-card border-2 border-dashed border-border px-4 py-6 active:bg-track"
            >
              <Plus size={28} color={colors["primary-strong"]} />
              <Text variante="seccion">¿Tienes otra mascota?</Text>
              <Text className="text-center text-muted">Agrégala y lleva su salud al día desde aquí.</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
