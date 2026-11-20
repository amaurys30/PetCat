import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AccessibilityInfo, View } from "react-native";

import { postRegistro } from "@/api/auth";
import { toApiError } from "@/api/errors";
import {
  Aviso,
  Button,
  Checkbox,
  Enlace,
  Input,
  MedidorPassword,
  PantallaFormulario,
  PasswordInput,
  ScreenHeader,
  Text,
} from "@/components/ui";
import { anunciarErrores, marcarErroresApi } from "@/lib/formularios";
import { RESPALDO } from "@/lib/navegacion";
import { useSesion } from "@/store/sesion";

import { iniciarSesion } from "../sesion/acciones";
import { useAbrirPolitica } from "./politica";
import { registroSchema, type RegistroForm } from "./schemas";

const CAMPOS = ["nombre", "apellido", "email", "password", "acepta_politica_datos"] as const;

type ErrorRegistro = { texto: string; activar?: boolean };

// M2 · Crear cuenta.
export function RegistroScreen() {
  const router = useRouter();
  const abrirPolitica = useAbrirPolitica();
  const [error, setError] = useState<ErrorRegistro | null>(null);

  const form = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
    defaultValues: { nombre: "", apellido: "", email: "", password: "", acepta_politica_datos: false },
  });
  const password = useWatch({ control: form.control, name: "password" });

  const enviarFormulario = form.handleSubmit(async (datos) => {
    setError(null);
    try {
      await postRegistro({ ...datos, acepta_politica_datos: true });
    } catch (e) {
      const apiError = toApiError(e);
      if (marcarErroresApi(apiError, form.setError, CAMPOS)) return;
      // 409: el correo ya tiene cuenta (también si la creó su veterinaria): activarla con un código.
      const nuevo = { texto: apiError.message, activar: apiError.status === 409 };
      setError(nuevo);
      AccessibilityInfo.announceForAccessibility(nuevo.texto);
      return;
    }

    // Cuenta creada: entra de una vez y pasa a confirmar el correo.
    try {
      useSesion.getState().setRecienRegistrado(true);
      await iniciarSesion(datos.email, datos.password);
    } catch {
      useSesion.getState().setRecienRegistrado(false);
      router.replace({ pathname: "/login", params: { email: datos.email, aviso: "cuenta-creada" } });
    }
  }, anunciarErrores);
  const enviar = () => void enviarFormulario();

  return (
    <PantallaFormulario
      pie={<Button titulo="Crear cuenta" cargando={form.formState.isSubmitting} onPress={enviar} />}
      cabecera={
        <ScreenHeader
          titulo="Crea tu cuenta"
          subtitulo="Es gratis. Solo te tomará un minuto."
          volverA={RESPALDO.bienvenida}
        />
      }
    >
      <View className="flex-row flex-wrap gap-3">
        <Controller
          control={form.control}
          name="nombre"
          render={({ field, fieldState }) => (
            <Input
              ref={field.ref}
              etiqueta="Nombre"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus("apellido")}
              className="min-w-[140px] flex-1"
            />
          )}
        />
        <Controller
          control={form.control}
          name="apellido"
          render={({ field, fieldState }) => (
            <Input
              ref={field.ref}
              etiqueta="Apellido"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus("email")}
              className="min-w-[140px] flex-1"
            />
          )}
        />
      </View>

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
              etiqueta="Contraseña"
              ayuda="Mínimo 8 caracteres, con letras y números."
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              returnKeyType="done"
            />
          )}
        />
        <MedidorPassword password={password} />
      </View>

      <View className="rounded-card bg-primary-soft px-4 py-2">
        <Controller
          control={form.control}
          name="acepta_politica_datos"
          render={({ field, fieldState }) => (
            <Checkbox
              etiqueta="Acepto la política de tratamiento de datos personales (Ley 1581 de 2012)."
              marcado={field.value}
              onCambiar={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Enlace titulo="Ver política" onPress={abrirPolitica} className="self-start" />
      </View>

      {error && (
        <Aviso
          tono="error"
          accion={
            error.activar ? (
              <Enlace
                titulo="Activar mi cuenta con este correo"
                onPress={() =>
                  router.push({ pathname: "/recuperar", params: { email: form.getValues("email") } })
                }
                className="self-start"
              />
            ) : undefined
          }
        >
          {error.texto}
        </Aviso>
      )}

      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-muted">¿Ya tienes cuenta? </Text>
        <Enlace titulo="Inicia sesión" onPress={() => router.replace("/login")} />
      </View>
    </PantallaFormulario>
  );
}
