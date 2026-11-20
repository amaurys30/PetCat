import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { FileText, PawPrint, QrCode } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MascotaConResumen } from "@/api/types";
import { Button, Card, EmptyState, Enlace, ErrorState, Skeleton, Text } from "@/components/ui";
import { AvisoSinConexion } from "@/features/mascotas/components/AvisoSinConexion";
import { useMascotaActual, useMascotas } from "@/features/mascotas/hooks";
import { hoyEnBogota } from "@/lib/fechas";
import { colors } from "@/theme/tokens";

import { AnilloVacunas } from "./components/AnilloVacunas";
import { PilaPasaportes } from "./components/PilaPasaportes";
import { LADO_SELLO, SelloVacuna } from "./components/SelloVacuna";
import { useUltimaDesparasitacion, useVacunas } from "./hooks";
import { construirAnillo, construirSellos } from "./logica";

/** Vivas primero (como las ordena la API), luego las que están «En memoria». */
const ordenar = (mascotas: MascotaConResumen[]) =>
  [...mascotas].sort((a, b) => Number(a.fallecido) - Number(b.fallecido));

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="gap-2 rounded-card border p-4"
      style={{ backgroundColor: colors["pasaporte-panel"], borderColor: colors["pasaporte-borde"] }}
    >
      {children}
    </View>
  );
}

/**
 * M7 · Pasaporte PetCat (pestaña Carnet). Fondo oscuro: textos con los tokens "sobre oscuro"
 * (contraste AA). Funciona sin red con la caché (mascotas, vacunas y última desparasitación).
 */
export function PasaporteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mascotas = useMascotas();
  const { actual, seleccionar } = useMascotaActual(mascotas.data);
  const lista = useMemo(() => ordenar(mascotas.data ?? []), [mascotas.data]);
  const [indice, setIndice] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      // Llega con la mascota elegida en Inicio (o en la ficha).
      const i = actual ? lista.findIndex((m) => m.id_mascota === actual.id_mascota) : -1;
      if (i >= 0) setIndice(i);
      return () => setStatusBarStyle("dark");
      // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al enfocar, no en cada cambio de la lista
    }, [actual?.id_mascota]),
  );

  const m = lista[Math.min(indice, lista.length - 1)];
  const vacunas = useVacunas(m?.id_mascota);
  const desparasitacion = useUltimaDesparasitacion(m?.id_mascota);
  const hoy = hoyEnBogota();
  const anillo = useMemo(
    () => (m && !m.fallecido && vacunas.data ? construirAnillo(vacunas.data, hoy) : null),
    [m, vacunas.data, hoy],
  );
  const sellos = useMemo(
    () =>
      m && vacunas.data
        ? construirSellos(vacunas.data, desparasitacion.data ?? null, { fallecido: m.fallecido, hoy })
        : [],
    [m, vacunas.data, desparasitacion.data, hoy],
  );

  const cambiar = (i: number) => {
    setIndice(i);
    const elegida = lista[i];
    // La selección global es la de las mascotas vivas (Inicio).
    if (elegida && !elegida.fallecido) seleccionar(elegida.id_mascota);
  };

  return (
    <LinearGradient colors={[colors["passport-from"], colors["passport-to"]]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, gap: 20 }}>
        <View className="gap-1 px-pantalla">
          <Text variante="titulo" className="text-white" accessibilityRole="header">
            Pasaporte
          </Text>
          {lista.length > 1 && (
            <Text variante="apoyo" style={{ color: colors["oscuro-muted"] }}>
              Desliza para cambiar de mascota
            </Text>
          )}
        </View>

        <AvisoSinConexion />

        {mascotas.isPending ? (
          <View
            className="gap-4 px-pantalla"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Cargando el pasaporte"
          >
            <Skeleton className="h-64 w-full rounded-[26px]" />
            <Skeleton className="h-24 w-full rounded-card" />
          </View>
        ) : mascotas.isError && !mascotas.data ? (
          <View className="px-pantalla">
            <Card>
              <ErrorState
                error={mascotas.error}
                onReintentar={() => mascotas.refetch()}
                reintentando={mascotas.isFetching}
              />
            </Card>
          </View>
        ) : !m ? (
          <View className="px-pantalla">
            <Card>
              <EmptyState
                icono={PawPrint}
                titulo="Tu primer pasaporte"
                descripcion="Agrega a tu mascota para llevar su carnet de vacunas en el teléfono."
                accion={{ etiqueta: "Agregar mascota", onPress: () => router.push("/mascotas/nueva") }}
              />
            </Card>
          </View>
        ) : (
          <>
            <PilaPasaportes mascotas={lista} indice={indice} onCambiar={cambiar} anillo={anillo} />

            <View className="gap-4 px-pantalla">
              {vacunas.isPending ? (
                <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando las vacunas">
                  <Skeleton className="h-24 w-full rounded-card" />
                </View>
              ) : vacunas.isError && !vacunas.data ? (
                <Card>
                  <ErrorState
                    error={vacunas.error}
                    titulo="No pudimos cargar las vacunas"
                    onReintentar={() => vacunas.refetch()}
                    reintentando={vacunas.isFetching}
                  />
                </Card>
              ) : (
                <>
                  {anillo && <AnilloVacunas anillo={anillo} />}
                  {m.fallecido && (
                    <Panel>
                      <Text className="text-white">
                        {`Conservamos el carnet de ${m.nombre}: sus vacunas quedan aquí como recuerdo, sin recordatorios.`}
                      </Text>
                    </Panel>
                  )}

                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text variante="seccion" className="text-white" accessibilityRole="header">
                      Sellos de vacunación
                    </Text>
                    <Enlace
                      titulo="Ver línea de vida"
                      accessibilityLabel={`Ver la línea de vida de ${m.nombre}`}
                      claro
                      onPress={() => router.push(`/mascotas/${m.id_mascota}/linea-vida`)}
                    />
                  </View>

                  {sellos.length === 0 ? (
                    <Panel>
                      <Text className="font-bold text-white">Aún no hay vacunas registradas</Text>
                      <Text variante="apoyo" style={{ color: colors["oscuro-muted"] }}>
                        Las vacunas que registre tu veterinaria en PetCat aparecerán aquí.
                      </Text>
                    </Panel>
                  ) : (
                    <View
                      className="flex-row flex-wrap justify-between gap-y-4"
                      style={{ minHeight: LADO_SELLO }}
                    >
                      {sellos.map((s, i) => (
                        <SelloVacuna key={s.clave} sello={s} indice={i} />
                      ))}
                    </View>
                  )}
                </>
              )}

              <View className="gap-2 pt-2">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      titulo="Compartir con QR"
                      icono={QrCode}
                      accessibilityLabel="Compartir con QR. Próximamente"
                      disabled
                      onPress={() => undefined}
                    />
                  </View>
                  <Button
                    titulo="PDF"
                    icono={FileText}
                    accessibilityLabel="Descargar PDF. Próximamente"
                    disabled
                    onPress={() => undefined}
                  />
                </View>
                <Text variante="apoyo" className="text-center" style={{ color: colors["oscuro-muted"] }}>
                  Compartir y descargar el pasaporte: próximamente.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}
