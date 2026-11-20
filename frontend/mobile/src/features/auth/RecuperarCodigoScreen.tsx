import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AccessibilityInfo, View } from "react-native";

import { postOlvidePassword, postRestablecerConCodigo } from "@/api/auth";
import { toApiError } from "@/api/errors";
import {
  Aviso,
  Button,
  CodigoInput,
  Enlace,
  MedidorPassword,
  PantallaFormulario,
  PasswordInput,
  ScreenHeader,
  Text,
} from "@/components/ui";
import { anunciarErrores, marcarErroresApi } from "@/lib/formularios";
import { RESPALDO } from "@/lib/navegacion";

import { iniciarSesion } from "../sesion/acciones";
import { restablecerSchema, type RestablecerForm } from "./schemas";

// Recuperar la contraseña, paso 2: el código del correo y la contraseña nueva. Después entra solo.
export function RecuperarCodigoScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);

  const form = useForm<RestablecerForm>({
    resolver: zodResolver(restablecerSchema),
    defaultValues: { codigo: "", password: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });

  if (!email) return <Redirect href="/recuperar" />;

  const enviarFormulario = form.handleSubmit(async ({ codigo, password }) => {
    setError(null);
    setInfo(null);
    try {
      await postRestablecerConCodigo(email, codigo, password);
    } catch (e) {
      const apiError = toApiError(e);
      if (marcarErroresApi(apiError, form.setError, ["codigo", "password"])) return;
      if (apiError.status === 400) {
        // Código que no coincide, vencido o anulado: el error va en el campo.
        form.setError("codigo", { type: "api", message: apiError.message }, { shouldFocus: true });
        AccessibilityInfo.announceForAccessibility(apiError.message);
        return;
      }
      setError(apiError.message);
      AccessibilityInfo.announceForAccessibility(apiError.message);
      return;
    }
    try {
      await iniciarSesion(email, password);
    } catch {
      router.replace({ pathname: "/login", params: { email, aviso: "password-restablecida" } });
    }
  }, anunciarErrores);
  const enviar = () => void enviarFormulario();

  const reenviar = async () => {
    setError(null);
    setReenviando(true);
    try {
      const mensaje = await postOlvidePassword(email);
      setInfo(mensaje);
      AccessibilityInfo.announceForAccessibility(mensaje);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setReenviando(false);
    }
  };

  return (
    <PantallaFormulario
      cabecera={<ScreenHeader titulo="Escribe el código" volverA={RESPALDO.recuperar} />}
      pie={<Button titulo="Guardar y entrar" cargando={form.formState.isSubmitting} onPress={enviar} />}
    >
      <Text className="text-muted">
        Si {email} tiene una cuenta, le enviamos un código de 6 dígitos. Vence en 15 minutos.
      </Text>

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
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => form.setFocus("password")}
          />
        )}
      />
      <View className="gap-2">
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordInput
              ref={field.ref}
              tipo="nueva"
              etiqueta="Contraseña nueva"
              ayuda="Mínimo 8 caracteres, con letras y números."
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              returnKeyType="go"
              onSubmitEditing={enviar}
            />
          )}
        />
        <MedidorPassword password={password} />
      </View>

      {error && <Aviso tono="error">{error}</Aviso>}
      {info && <Aviso tono="info">{info}</Aviso>}

      <Enlace
        rol="button"
        titulo={reenviando ? "Enviando…" : "Reenviar código"}
        disabled={reenviando}
        onPress={reenviar}
        className="self-center"
      />
      <Aviso tono="consejo">Si no te llega, revisa la carpeta de spam o de promociones.</Aviso>
    </PantallaFormulario>
  );
}
