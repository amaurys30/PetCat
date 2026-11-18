import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AccessibilityInfo } from "react-native";

import { postOlvidePassword } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { Aviso, Button, Input, PantallaFormulario, ScreenHeader, Text } from "@/components/ui";
import { anunciarErrores } from "@/lib/formularios";
import { RESPALDO } from "@/lib/navegacion";

import { recuperarSchema, type RecuperarForm } from "./schemas";

// Recuperar la contraseña, paso 1: el correo. También activa la cuenta de quien registró su veterinaria.
export function RecuperarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RecuperarForm>({
    resolver: zodResolver(recuperarSchema),
    defaultValues: { email: params.email ?? "" },
  });

  const enviarFormulario = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      // La API responde igual exista o no la cuenta (no la delata).
      await postOlvidePassword(email);
      router.push({ pathname: "/recuperar-codigo", params: { email } });
    } catch (e) {
      const mensaje = toApiError(e).message;
      setError(mensaje);
      AccessibilityInfo.announceForAccessibility(mensaje);
    }
  }, anunciarErrores);
  const enviar = () => void enviarFormulario();

  return (
    <PantallaFormulario cabecera={<ScreenHeader titulo="Recupera tu contraseña" volverA={RESPALDO.login} />}>
      <Text className="text-muted">
        Te enviaremos un código de 6 dígitos a tu correo para que elijas una contraseña nueva. Si tu
        veterinaria te registró, así activas tu cuenta.
      </Text>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Correo electrónico"
            icono={Mail}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={enviar}
          />
        )}
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      <Button titulo="Enviar código" cargando={form.formState.isSubmitting} onPress={enviar} />
    </PantallaFormulario>
  );
}
