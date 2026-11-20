import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { AccessibilityInfo, Alert, View } from "react-native";

import { toApiError } from "@/api/errors";
import type { Mascota } from "@/api/types";
import { Aviso, Button, ErrorState, PantallaFormulario, ScreenHeader, SkeletonLista, Text } from "@/components/ui";
import { formatearFecha } from "@/lib/formatos";
import { anunciarErrores, marcarErroresApi } from "@/lib/formularios";
import { segunSexo } from "@/lib/mascotas";
import { volverOIr } from "@/lib/navegacion";

import { CamposBasicos, CamposSalud } from "../components/CamposMascota";
import { FotoMascota } from "../components/FotoMascota";
import { aCambios, desdeMascota, mascotaSchema, VACIO, type MascotaForm } from "../formulario";
import {
  useEditarMascota,
  useEliminarMascota,
  useMascota,
  useQuitarFoto,
  useSoloLectura,
  useSubirFoto,
} from "../hooks";

const CAMPOS_API = Object.keys(VACIO) as (keyof MascotaForm)[];

export function EditarMascotaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const id_mascota = Number(id);
  const mascota = useMascota(id_mascota);

  if (mascota.isPending) return <View className="flex-1 bg-surface pt-24"><SkeletonLista filas={3} etiqueta="Cargando" /></View>;
  if (!mascota.data) {
    return (
      <View className="flex-1 justify-center bg-surface">
        <ErrorState error={mascota.error} onReintentar={() => mascota.refetch()} reintentando={mascota.isFetching} />
      </View>
    );
  }
  return <Formulario mascota={mascota.data} />;
}

/**
 * Editar: datos y salud en una pantalla; solo se envía lo que cambió. La foto se aplica al
 * momento (se sube o se quita). Al final, aparte: registrar el fallecimiento y eliminar.
 */
function Formulario({ mascota }: { mascota: Mascota }) {
  const router = useRouter();
  const id_mascota = mascota.id_mascota;
  const soloLectura = useSoloLectura();
  const editar = useEditarMascota(id_mascota);
  const eliminar = useEliminarMascota(id_mascota);
  const subirFoto = useSubirFoto(id_mascota);
  const quitarFoto = useQuitarFoto(id_mascota);
  const [error, setError] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<{ texto: string; uri?: string } | null>(null);

  const inicial = useMemo(() => desdeMascota(mascota), [mascota]);
  const form = useForm<MascotaForm>({ resolver: zodResolver(mascotaSchema), defaultValues: inicial });
  const volver = () => volverOIr(router, `/mascotas/${id_mascota}`);

  const guardar = form.handleSubmit(async (valores) => {
    setError(null);
    const cambios = aCambios(valores, inicial);
    if (Object.keys(cambios).length === 0) {
      AccessibilityInfo.announceForAccessibility("No hay cambios");
      return volver();
    }
    try {
      await editar.mutateAsync(cambios);
      AccessibilityInfo.announceForAccessibility("Cambios guardados");
      volver();
    } catch (e) {
      const apiError = toApiError(e);
      if (marcarErroresApi(apiError, form.setError, CAMPOS_API)) return;
      setError(apiError.message);
      AccessibilityInfo.announceForAccessibility(apiError.message);
    }
  }, anunciarErrores);

  const cambiarFoto = async (uri: string) => {
    setErrorFoto(null);
    try {
      await subirFoto.mutateAsync(uri);
      AccessibilityInfo.announceForAccessibility("Foto actualizada");
    } catch (e) {
      setErrorFoto({ texto: `La foto no se pudo subir: ${toApiError(e).message}`, uri });
    }
  };

  const confirmarQuitarFoto = () =>
    Alert.alert("Quitar la foto", `¿Quitar la foto de ${mascota.nombre}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () =>
          quitarFoto.mutateAsync().catch((e) => setErrorFoto({ texto: toApiError(e).message })),
      },
    ]);

  const confirmarEliminar = () =>
    Alert.alert(
      `Eliminar a ${mascota.nombre}`,
      "Dejará de aparecer en la app. Su historial y sus citas se conservan en las veterinarias. No se puede deshacer desde la app.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setError(null);
            try {
              await eliminar.mutateAsync();
              AccessibilityInfo.announceForAccessibility(`${mascota.nombre} se eliminó`);
              router.replace("/mascotas");
            } catch (e) {
              // 409: tiene citas pendientes o confirmadas (el mensaje de la API lo explica).
              const mensaje = toApiError(e).message;
              setError(mensaje);
              AccessibilityInfo.announceForAccessibility(mensaje);
            }
          },
        },
      ],
    );

  const confirmarCorreccion = () =>
    Alert.alert(
      "Corregir el registro",
      `¿${mascota.nombre} no ha fallecido? Volverá a aparecer como una mascota activa.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Corregir",
          onPress: () => editar.mutateAsync({ fallecido: false }).catch((e) => setError(toApiError(e).message)),
        },
      ],
    );

  return (
    <PantallaFormulario cabecera={<ScreenHeader titulo={`Editar a ${mascota.nombre}`} volverA={`/mascotas/${id_mascota}`} />}>
      {soloLectura && <Aviso tono="error">Sin conexión. Podrás guardar cambios cuando vuelva la conexión.</Aviso>}

      <FotoMascota
        nombre={mascota.nombre}
        especie={mascota.especie}
        uri={mascota.foto_url}
        onElegir={cambiarFoto}
        onQuitar={confirmarQuitarFoto}
        deshabilitado={soloLectura || subirFoto.isPending || quitarFoto.isPending}
      />
      {(subirFoto.isPending || quitarFoto.isPending) && (
        <Text variante="apoyo" className="text-center text-muted" accessibilityLiveRegion="polite">
          Actualizando la foto…
        </Text>
      )}
      {errorFoto && (
        <Aviso
          tono="error"
          accion={
            errorFoto.uri ? (
              <Button titulo="Reintentar" variante="secundario" onPress={() => cambiarFoto(errorFoto.uri!)} />
            ) : undefined
          }
        >
          {errorFoto.texto}
        </Aviso>
      )}

      <Text variante="seccion">Datos</Text>
      <CamposBasicos form={form} />
      <Text variante="seccion">Salud</Text>
      <CamposSalud form={form} />

      {error && <Aviso tono="error">{error}</Aviso>}
      <Button
        titulo="Guardar cambios"
        cargando={form.formState.isSubmitting}
        disabled={soloLectura}
        onPress={() => void guardar()}
      />

      <View className="mt-6 gap-3 border-t border-border pt-6">
        <Text variante="seccion">Otras opciones</Text>
        {mascota.fallecido ? (
          <>
            <Text className="text-muted">
              {`Registrada como ${segunSexo(mascota.sexo, "fallecido", "fallecida")}${
                mascota.fecha_fallecimiento ? ` el ${formatearFecha(mascota.fecha_fallecimiento, { anio: true })}` : ""
              }.`}
            </Text>
            <Button titulo="Corregir: no ha fallecido" variante="secundario" disabled={soloLectura} onPress={confirmarCorreccion} />
          </>
        ) : (
          <Button
            titulo="Registrar fallecimiento"
            variante="secundario"
            disabled={soloLectura}
            onPress={() => router.push(`/mascotas/${id_mascota}/fallecimiento`)}
          />
        )}
        <Button titulo={`Eliminar a ${mascota.nombre}`} variante="peligro" disabled={soloLectura} onPress={confirmarEliminar} />
      </View>
    </PantallaFormulario>
  );
}
