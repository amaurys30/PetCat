import { useRouter } from "expo-router";
import { PawPrint } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/errors";
import { Avatar, EmptyState, Enlace, ErrorState, Skeleton, Text } from "@/components/ui";
import { saludo } from "@/lib/saludo";
import { useNombreUsuario, useSesion } from "@/store/sesion";

import { AvisoSinConexion } from "../components/AvisoSinConexion";
import { HeroMascota } from "../components/HeroMascota";
import { Recordatorios } from "../components/Recordatorios";
import { SelectorMascotas } from "../components/SelectorMascotas";
import { TarjetaProximaCita } from "../components/TarjetaProximaCita";
import { useMascotaActual, useMascotas, useSoloLectura } from "../hooks";

/**
 * M4 · Inicio. Saludo, selector de mascotas, tarjeta principal (con el Pasaporte), próxima cita
 * y recordatorios. Lo de fases futuras (campana, evento destacado, accesos a Mapa, Eventos y
 * Tiendas, "Ver todas" las citas) no se muestra hasta que exista.
 */
export function InicioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const nombre = useNombreUsuario();
  const fotoUsuario = useSesion((s) => s.usuario?.foto_miniatura_url ?? null);
  const soloLectura = useSoloLectura();
  const mascotas = useMascotas();
  const { actual, vivas, seleccionar } = useMascotaActual(mascotas.data);

  const abrirPasaporte = () => {
    if (actual) seleccionar(actual.id_mascota);
    router.navigate("/carnet");
  };

  const sinConexionConDatos =
    mascotas.data && mascotas.error instanceof ApiError && mascotas.error.sinConexion;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
    >
      <View className="mb-5 flex-row items-center gap-3 px-pantalla">
        <Avatar nombre={nombre || "Tú"} uri={fotoUsuario} tamano="md" />
        <View className="flex-1">
          <Text variante="apoyo" className="text-muted">
            {saludo()},
          </Text>
          <Text variante="titulo" accessibilityRole="header">
            {nombre}
          </Text>
        </View>
      </View>

      <AvisoSinConexion />

      {mascotas.isPending ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Cargando tus mascotas"
          className="gap-4 px-pantalla"
        >
          <Skeleton className="h-14 w-48 rounded-full" />
          <Skeleton className="h-72 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
        </View>
      ) : mascotas.isError && !mascotas.data ? (
        <ErrorState
          error={mascotas.error}
          onReintentar={() => mascotas.refetch()}
          reintentando={mascotas.isFetching}
        />
      ) : !actual ? (
        <EmptyState
          icono={PawPrint}
          titulo={
            vivas.length === 0 && (mascotas.data?.length ?? 0) > 0
              ? "No hay mascotas activas"
              : "Agrega tu primera mascota"
          }
          descripcion="Lleva su carnet de vacunas, sus citas y sus recordatorios en un solo lugar."
          accion={
            soloLectura
              ? undefined
              : { etiqueta: "Agregar mascota", onPress: () => router.push("/mascotas/nueva") }
          }
        />
      ) : (
        <View className="gap-6">
          {sinConexionConDatos && !soloLectura && (
            <Text variante="apoyo" className="px-pantalla text-danger-ink" accessibilityLiveRegion="polite">
              Sin conexión: mostramos los últimos datos guardados.
            </Text>
          )}
          <View className="gap-2">
            <View className="flex-row items-center justify-between px-pantalla">
              <Text variante="seccion">Tus mascotas</Text>
              <Enlace
                titulo="Ver todas"
                accessibilityLabel="Ver todas mis mascotas"
                onPress={() => router.push("/mascotas")}
              />
            </View>
            <SelectorMascotas
              mascotas={vivas}
              actual={actual.id_mascota}
              onElegir={seleccionar}
              puedeAgregar={!soloLectura}
            />
          </View>

          <View className="px-pantalla">
            <HeroMascota mascota={actual} onAbrirPasaporte={abrirPasaporte} />
          </View>

          <View className="gap-3 px-pantalla">
            <Text variante="seccion">Próxima cita</Text>
            {actual.resumen.proxima_cita ? (
              <TarjetaProximaCita cita={actual.resumen.proxima_cita} mascota={actual.nombre} />
            ) : (
              <Text className="text-muted">{actual.nombre} no tiene citas próximas.</Text>
            )}
          </View>

          {actual.resumen.proximos_eventos.length > 0 && (
            <View className="gap-3">
              <Text variante="seccion" className="px-pantalla">
                Recordatorios
              </Text>
              <Recordatorios eventos={actual.resumen.proximos_eventos} />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
