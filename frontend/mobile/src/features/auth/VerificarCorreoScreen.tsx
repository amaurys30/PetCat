import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AccessibilityInfo, View } from "react-native";

import { postReenviarVerificacion, postVerificarCorreo } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { Aviso, Button, CodigoInput, Enlace, PantallaFormulario, Text } from "@/components/ui";
import { anunciarErrores } from "@/lib/formularios";
import { useSesion } from "@/store/sesion";
import { colors } from "@/theme/tokens";

import { verificarSchema, type VerificarForm } from "./schemas";

// Confirmar el correo con el código (después del registro o desde Perfil). No es obligatorio:
// el correo sin confirmar no impide usar la app.
export function VerificarCorreoScreen() {
  const router = useRouter();
  const usuario = useSesion((s) => s.usuario);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);

  // La marca solo sirve para llegar aquí después del registro.
  useEffect(() => {
    useSesion.getState().setRecienRegistrado(false);
  }, []);

  const form = useForm<VerificarForm>({
    resolver: zodResolver(verificarSchema),
    defaultValues: { codigo: "" },
  });

  const marcarVerificado = () => {
    if (usuario) useSesion.getState().setUsuario({ ...usuario, email_verificado: true });
    AccessibilityInfo.announceForAccessibility("Correo confirmado");
    router.replace("/");
  };

  const enviarFormulario = form.handleSubmit(async ({ codigo }) => {
    setError(null);
    try {
      await postVerificarCorreo(codigo);
      marcarVerificado();
    } catch (e) {
      const apiError = toApiError(e);
      if (apiError.status === 409) return marcarVerificado();
      if (apiError.status === 400) {
        form.setError("codigo", { type: "api", message: apiError.message }, { shouldFocus: true });
        AccessibilityInfo.announceForAccessibility(apiError.message);
        return;
      }
      setError(apiError.message);
      AccessibilityInfo.announceForAccessibility(apiError.message);
    }
  }, anunciarErrores);
  const enviar = () => void enviarFormulario();

  const reenviar = async () => {
    setError(null);
    setInfo(null);
    setReenviando(true);
    try {
      const mensaje = await postReenviarVerificacion();
      setInfo(mensaje);
      AccessibilityInfo.announceForAccessibility(mensaje);
    } catch (e) {
      const apiError = toApiError(e);
      if (apiError.status === 409) return marcarVerificado();
      // 429: "Ya te enviamos un correo hace menos de un minuto…" (el mensaje de la API).
      setError(apiError.message);
      AccessibilityInfo.announceForAccessibility(apiError.message);
    } finally {
      setReenviando(false);
    }
  };

  return (
    <PantallaFormulario
      pie={<Button titulo="Confirmar" cargando={form.formState.isSubmitting} onPress={enviar} />}
    >
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
        <MailCheck size={36} color={colors["primary-deep"]} accessibilityElementsHidden />
      </View>
      <View className="gap-2">
        <Text variante="titulo">Confirma tu correo</Text>
        <Text className="text-muted">
          Escribe el código de 6 dígitos que enviamos a {usuario?.email ?? "tu correo"}. Vence en 15 minutos.
        </Text>
      </View>

      <Controller
        control={form.control}
        name="codigo"
        render={({ field, fieldState }) => (
          <CodigoInput
            ref={field.ref}
            etiqueta="Código del correo"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            returnKeyType="go"
            onSubmitEditing={enviar}
          />
        )}
      />

      {error && <Aviso tono="error">{error}</Aviso>}
      {info && <Aviso tono="info">{info}</Aviso>}

      <View className="flex-row flex-wrap justify-between gap-2">
        <Enlace
          rol="button"
          titulo={reenviando ? "Enviando…" : "Reenviar código"}
          disabled={reenviando}
          onPress={reenviar}
        />
        <Enlace rol="button" titulo="Hacerlo después" onPress={() => router.replace("/")} />
      </View>
    </PantallaFormulario>
  );
}
