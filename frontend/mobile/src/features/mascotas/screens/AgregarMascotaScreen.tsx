import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AccessibilityInfo, View } from "react-native";

import { putFotoMascota } from "@/api/mascotas";
import { toApiError } from "@/api/errors";
import type { Mascota } from "@/api/types";
import { Aviso, Button, PantallaFormulario, ScreenHeader, Text } from "@/components/ui";
import { anunciarErrores, marcarErroresApi } from "@/lib/formularios";
import { RESPALDO } from "@/lib/navegacion";
import { queryKeys } from "@/lib/queryKeys";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
import { useIdUsuario } from "@/store/sesion";

import { CamposBasicos, CamposSalud } from "../components/CamposMascota";
import { FotoMascota } from "../components/FotoMascota";
import { aDatos, CAMPOS_PASO_1, mascotaSchema, VACIO, type MascotaForm } from "../formulario";
import { useCrearMascota, useSoloLectura } from "../hooks";

const CAMPOS_API = Object.keys(VACIO) as (keyof MascotaForm)[];

/**
 * M21 · Nueva mascota, en dos pasos. Primero se crea la mascota y después se sube la foto (la
 * foto necesita su id). Si la foto falla, la mascota ya quedó guardada: se puede reintentar
 * mientras la pantalla siga abierta, o seguir sin foto.
 */
export function AgregarMascotaScreen() {
  const router = useRouter();
  const crear = useCrearMascota();
  const soloLectura = useSoloLectura();
  const id_usuario = useIdUsuario();
  const seleccionar = useMascotaSeleccionada((s) => s.seleccionar);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<Mascota | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<MascotaForm>({ resolver: zodResolver(mascotaSchema), defaultValues: VACIO });
  const nombre = useWatch({ control: form.control, name: "nombre" });
  const especie = useWatch({ control: form.control, name: "especie" });

  const irAPaso = (n: 1 | 2) => {
    setPaso(n);
    AccessibilityInfo.announceForAccessibility(`Paso ${n} de 2`);
  };

  const continuar = async () => {
    if (await form.trigger(CAMPOS_PASO_1, { shouldFocus: true })) return irAPaso(2);
    // formState.errors todavía no se actualizó en este render; getFieldState sí lo tiene.
    anunciarErrores(Object.fromEntries(CAMPOS_PASO_1.map((c) => [c, form.getFieldState(c).error])));
  };

  const terminar = (mascota: Mascota) => router.replace(`/mascotas/${mascota.id_mascota}`);

  const subirFoto = async (mascota: Mascota, uri: string) => {
    setSubiendo(true);
    setErrorFoto(null);
    try {
      await putFotoMascota(mascota.id_mascota, uri);
      await queryClient.invalidateQueries({ queryKey: queryKeys.mascotas.todas() });
      terminar(mascota);
    } catch (e) {
      const mensaje = toApiError(e).message;
      setErrorFoto(mensaje);
      AccessibilityInfo.announceForAccessibility(`${mascota.nombre} quedó guardada, pero la foto no se pudo subir`);
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = form.handleSubmit(async (valores) => {
    setError(null);
    try {
      const mascota = await crear.mutateAsync(aDatos(valores));
      if (id_usuario) seleccionar(id_usuario, mascota.id_mascota);
      setCreada(mascota);
      if (foto) await subirFoto(mascota, foto);
      else terminar(mascota);
    } catch (e) {
      const apiError = toApiError(e);
      if (marcarErroresApi(apiError, form.setError, CAMPOS_API)) {
        const enPaso1 = CAMPOS_PASO_1.some((c) => typeof apiError.errors[c] === "string");
        if (enPaso1) irAPaso(1);
        return;
      }
      setError(apiError.message);
      AccessibilityInfo.announceForAccessibility(apiError.message);
    }
  }, anunciarErrores);

  // Mascota guardada, foto pendiente: no se pierde lo hecho.
  if (creada && errorFoto) {
    return (
      <PantallaFormulario cabecera={<ScreenHeader titulo="Nueva mascota" />}>
        <Aviso tono="error">{`${creada.nombre} quedó guardada, pero la foto no se pudo subir: ${errorFoto}`}</Aviso>
        <Button titulo="Reintentar subir la foto" cargando={subiendo} onPress={() => foto && subirFoto(creada, foto)} />
        <Button titulo="Seguir sin foto" variante="secundario" onPress={() => terminar(creada)} />
        <Text variante="apoyo" className="text-muted">
          Puedes agregar la foto después desde Editar.
        </Text>
      </PantallaFormulario>
    );
  }

  return (
    <PantallaFormulario
      cabecera={<ScreenHeader titulo="Nueva mascota" subtitulo={`Paso ${paso} de 2`} volverA={RESPALDO.inicio} />}
    >
      {soloLectura && <Aviso tono="error">Sin conexión. Podrás agregar la mascota cuando vuelva la conexión.</Aviso>}
      {paso === 1 ? (
        <View className="gap-5">
          <FotoMascota nombre={nombre} especie={especie} uri={foto} onElegir={setFoto} onQuitar={() => setFoto(null)} />
          <CamposBasicos form={form} />
          <Button titulo="Continuar" onPress={continuar} />
        </View>
      ) : (
        <View className="gap-5">
          <Text className="text-muted">Todo es opcional: puedes completarlo después.</Text>
          <CamposSalud form={form} />
          {error && <Aviso tono="error">{error}</Aviso>}
          <Button
            titulo="Guardar mascota"
            cargando={form.formState.isSubmitting || subiendo}
            disabled={soloLectura}
            onPress={() => void guardar()}
          />
          <Button titulo="Volver al paso 1" variante="secundario" onPress={() => irAPaso(1)} />
        </View>
      )}
    </PantallaFormulario>
  );
}
