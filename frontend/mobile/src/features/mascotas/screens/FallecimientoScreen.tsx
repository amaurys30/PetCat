import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { useState } from "react";
import { AccessibilityInfo, Alert, View } from "react-native";

import { toApiError } from "@/api/errors";
import { Aviso, Button, ErrorState, Input, PantallaFormulario, ScreenHeader, SkeletonLista, Text } from "@/components/ui";
import { hoyEnBogota } from "@/lib/fechas";
import { aplicarMascaraFecha, esFutura, fechaApiAMascara, mascaraAFechaApi } from "@/lib/fechaMascara";
import { formatearFecha } from "@/lib/formatos";
import { colors } from "@/theme/tokens";

import { useEditarMascota, useMascota, useSoloLectura } from "../hooks";

/**
 * Registrar el fallecimiento (opción aparte al final de Editar). Textos cuidadosos, fecha (hoy
 * por defecto) y confirmación. La API da 409 si la mascota tiene citas pendientes o confirmadas.
 */
export function FallecimientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const id_mascota = Number(id);
  const router = useRouter();
  const mascota = useMascota(id_mascota);
  const editar = useEditarMascota(id_mascota);
  const soloLectura = useSoloLectura();
  const [fecha, setFecha] = useState(fechaApiAMascara(hoyEnBogota()));
  const [errorFecha, setErrorFecha] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  if (mascota.isPending) return <View className="flex-1 bg-surface pt-24"><SkeletonLista filas={2} /></View>;
  if (!mascota.data) return <ErrorState error={mascota.error} onReintentar={() => mascota.refetch()} />;
  const m = mascota.data;

  const validarFecha = (): string | null => {
    const valor = mascaraAFechaApi(fecha);
    let problema: string | undefined;
    if (!valor) problema = "Escribe una fecha real, como 15/03/2026";
    else if (esFutura(valor)) problema = "No puede ser una fecha futura";
    else if (m.fecha_nacimiento && valor < m.fecha_nacimiento) problema = "No puede ser anterior a su nacimiento";
    setErrorFecha(problema);
    if (problema) AccessibilityInfo.announceForAccessibility(problema);
    return problema ? null : valor;
  };

  const registrar = async (fecha_fallecimiento: string) => {
    setError(null);
    try {
      await editar.mutateAsync({ fallecido: true, fecha_fallecimiento });
      AccessibilityInfo.announceForAccessibility(`Registramos el fallecimiento de ${m.nombre}`);
      router.replace(`/mascotas/${id_mascota}`);
    } catch (e) {
      // 409: tiene citas pendientes o confirmadas; el mensaje de la API dice qué hacer.
      const mensaje = toApiError(e).message;
      setError(mensaje);
      AccessibilityInfo.announceForAccessibility(mensaje);
    }
  };

  const confirmar = () => {
    const valor = validarFecha();
    if (!valor) return;
    Alert.alert(
      "Confirmar",
      `¿Registrar que ${m.nombre} falleció el ${formatearFecha(valor, { anio: true })}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Registrar", onPress: () => registrar(valor) },
      ],
    );
  };

  return (
    <PantallaFormulario cabecera={<ScreenHeader titulo="Registrar fallecimiento" volverA={`/mascotas/${id_mascota}/editar`} />}>
      <View className="items-center gap-3 py-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-lavender-soft">
          <Heart size={30} color={colors["lavender-ink"]} accessibilityElementsHidden />
        </View>
        <Text variante="seccion" className="text-center">
          Lamentamos mucho tu pérdida.
        </Text>
      </View>
      <Text>{`Si registras que ${m.nombre} ha fallecido:`}</Text>
      <View className="gap-2 pl-2">
        <Text>• Conservamos su carnet de vacunas y su historial, por si los necesitas.</Text>
        <Text>• Dejarás de recibir recordatorios de sus vacunas.</Text>
        <Text>• Aparecerá al final de Mis mascotas, «En memoria».</Text>
        <Text>• Si fue un error, puedes corregirlo después desde Editar.</Text>
      </View>
      <Input
        etiqueta="Fecha"
        ayuda="Día, mes y año."
        placeholder="dd/mm/aaaa"
        value={fecha}
        onChangeText={(t) => {
          setFecha(aplicarMascaraFecha(t));
          setErrorFecha(undefined);
        }}
        error={errorFecha}
        keyboardType="number-pad"
        maxLength={10}
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      {soloLectura && <Aviso tono="error">Sin conexión. Podrás registrarlo cuando vuelva la conexión.</Aviso>}
      <Button titulo="Registrar fallecimiento" cargando={editar.isPending} disabled={soloLectura} onPress={confirmar} />
      <Button titulo="Cancelar" variante="secundario" onPress={() => router.back()} />
    </PantallaFormulario>
  );
}
