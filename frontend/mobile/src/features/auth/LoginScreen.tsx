import { zodResolver } from "@hookform/resolvers/zod";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Mail, PawPrint } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AccessibilityInfo, View } from "react-native";

import { toApiError } from "@/api/errors";
import { Aviso, Button, Enlace, Input, PantallaFormulario, PasswordInput, Text } from "@/components/ui";
import { anunciarErrores, marcarErroresApi } from "@/lib/formularios";
import { colors, gradients } from "@/theme/tokens";

import { iniciarSesion } from "../sesion/acciones";
import { loginSchema, type LoginForm } from "./schemas";

/** 401 del login: "Credenciales inválidas" de la API es poco claro para el usuario. */
export const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.";

const AVISOS = {
  "cuenta-creada": "Tu cuenta está creada. Inicia sesión para entrar.",
  "password-restablecida": "Tu contraseña está lista. Inicia sesión con la nueva.",
} as const;

type ErrorLogin = { texto: string; recuperar?: boolean };

// M3 · Iniciar sesión.
export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; aviso?: keyof typeof AVISOS }>();
  const [error, setError] = useState<ErrorLogin | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: params.email ?? "", password: "" },
  });

  const enviarFormulario = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      // Con la sesión iniciada, las rutas protegidas llevan a las pestañas (o a aceptar la política).
      await iniciarSesion(email, password);
    } catch (e) {
      const apiError = toApiError(e);
      if (marcarErroresApi(apiError, form.setError, ["email", "password"])) return;
      const nuevo: ErrorLogin =
        apiError.status === 401
          ? { texto: MENSAJE_CREDENCIALES }
          : // Cuenta bloqueada por intentos: restablecer la contraseña la desbloquea.
            {
              texto: apiError.message,
              recuperar: apiError.status === 403 && /bloquead/i.test(apiError.message),
            };
      setError(nuevo);
      AccessibilityInfo.announceForAccessibility(nuevo.texto);
    }
  }, anunciarErrores);
  const enviar = () => void enviarFormulario();

  const irARecuperar = () =>
    router.push({ pathname: "/recuperar", params: { email: form.getValues("email") } });

  return (
    <PantallaFormulario
      pie={<Button titulo="Entrar" cargando={form.formState.isSubmitting} onPress={enviar} />}
    >
      <LinearGradient
        colors={gradients.brand.colors}
        locations={gradients.brand.locations}
        style={{ width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
      >
        <PawPrint size={30} color={colors.white} accessibilityElementsHidden />
      </LinearGradient>

      <View className="gap-2">
        <Text variante="titulo">¡Hola de nuevo!</Text>
        <Text className="text-muted">Entra para ver a tus mascotas y sus próximas citas.</Text>
      </View>

      {params.aviso && AVISOS[params.aviso] && <Aviso tono="info">{AVISOS[params.aviso]}</Aviso>}

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
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={field.ref}
            tipo="actual"
            etiqueta="Contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            returnKeyType="go"
            onSubmitEditing={enviar}
          />
        )}
      />

      <Enlace titulo="¿Olvidaste tu contraseña?" onPress={irARecuperar} className="-mt-2 self-end" />

      {error && (
        <Aviso
          tono="error"
          accion={
            error.recuperar ? (
              <Enlace titulo="Restablecer mi contraseña" onPress={irARecuperar} className="self-start" />
            ) : undefined
          }
        >
          {error.texto}
        </Aviso>
      )}

      <Aviso tono="consejo">
        ¿Tu veterinaria te registró? Usa “¿Olvidaste tu contraseña?” con tu correo para activar tu cuenta.
      </Aviso>

      <View className="mt-auto flex-row flex-wrap items-center justify-center">
        <Text className="text-muted">¿Nuevo en PetCat? </Text>
        <Enlace titulo="Crea tu cuenta" onPress={() => router.replace("/registro")} />
      </View>
    </PantallaFormulario>
  );
}
