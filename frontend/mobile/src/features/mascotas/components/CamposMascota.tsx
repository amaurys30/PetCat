import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { View } from "react-native";

import { Input, Segmented, Text, Toggle } from "@/components/ui";
import { aplicarMascaraFecha } from "@/lib/fechaMascara";
import { SEXOS } from "@/lib/mascotas";

import type { MascotaForm } from "../formulario";
import { CampoRaza } from "./CampoRaza";
import { SelectorEspecie } from "./SelectorEspecie";

type Props = { form: UseFormReturn<MascotaForm> };

/** Paso 1 (y primera parte de Editar): qué es, nombre, raza, nacimiento y sexo. */
export function CamposBasicos({ form }: Props) {
  const especie = useWatch({ control: form.control, name: "especie" });
  return (
    <View className="gap-5">
      <Controller
        control={form.control}
        name="especie"
        render={({ field, fieldState }) => (
          <SelectorEspecie valor={field.value} onCambiar={field.onChange} error={fieldState.error?.message} />
        )}
      />
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
            maxLength={80}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => form.setFocus("raza")}
          />
        )}
      />
      <Controller
        control={form.control}
        name="raza"
        render={({ field, fieldState }) => (
          <CampoRaza
            ref={field.ref}
            especie={especie}
            valor={field.value}
            onCambiar={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            onSiguiente={() => form.setFocus("fecha_nacimiento")}
          />
        )}
      />
      <Controller
        control={form.control}
        name="fecha_nacimiento"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Fecha de nacimiento (opcional)"
            ayuda="Día, mes y año, como 15/03/2021."
            placeholder="dd/mm/aaaa"
            value={field.value}
            onChangeText={(t) => field.onChange(aplicarMascaraFecha(t))}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="done"
          />
        )}
      />
      <View className="gap-2">
        <Text variante="apoyo" importantForAccessibility="no">
          Sexo
        </Text>
        <Controller
          control={form.control}
          name="sexo"
          render={({ field }) => (
            <Segmented etiqueta="Sexo" valor={field.value} onCambiar={field.onChange} opciones={SEXOS} />
          )}
        />
      </View>
    </View>
  );
}

/** Paso 2 (y segunda parte de Editar): peso y datos de salud, todos opcionales. */
export function CamposSalud({ form }: Props) {
  const tieneAlergias = useWatch({ control: form.control, name: "tiene_alergias" });
  const sexo = useWatch({ control: form.control, name: "sexo" });

  return (
    <View className="gap-5">
      <Controller
        control={form.control}
        name="peso"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Peso en kilos (opcional)"
            placeholder="28,4"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="decimal-pad"
            maxLength={7}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => form.setFocus("color")}
          />
        )}
      />
      <Controller
        control={form.control}
        name="color"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Color (opcional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            maxLength={100}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => form.setFocus("microchip")}
          />
        )}
      />
      <Controller
        control={form.control}
        name="microchip"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Número de microchip (opcional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="number-pad"
            maxLength={50}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => form.setFocus(tieneAlergias ? "alergias_detalle" : "condiciones_medicas")}
          />
        )}
      />
      <Controller
        control={form.control}
        name="esterilizado"
        render={({ field }) => (
          <Toggle
            etiqueta={sexo === "hembra" ? "Está esterilizada" : "Está esterilizado"}
            activo={field.value}
            onCambiar={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="tiene_alergias"
        render={({ field }) => (
          <Toggle etiqueta="Tiene alergias" activo={field.value} onCambiar={field.onChange} />
        )}
      />
      {tieneAlergias && (
        <Controller
          control={form.control}
          name="alergias_detalle"
          render={({ field, fieldState }) => (
            <Input
              ref={field.ref}
              etiqueta="¿Qué alergias tiene?"
              placeholder="Por ejemplo: pollo (leve)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              multiline
              maxLength={2000}
            />
          )}
        />
      )}
      <Controller
        control={form.control}
        name="condiciones_medicas"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Condiciones médicas (opcional)"
            placeholder="Por ejemplo: displasia de cadera"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            multiline
            maxLength={2000}
          />
        )}
      />
      <Controller
        control={form.control}
        name="tipo_sangre"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Tipo de sangre (opcional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="characters"
            maxLength={10}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => form.setFocus("numero_registro")}
          />
        )}
      />
      <Controller
        control={form.control}
        name="numero_registro"
        render={({ field, fieldState }) => (
          <Input
            ref={field.ref}
            etiqueta="Número de registro (opcional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            maxLength={60}
            returnKeyType="done"
          />
        )}
      />
      <Controller
        control={form.control}
        name="compartir_historial"
        render={({ field }) => (
          <Toggle
            etiqueta="Compartir su historial con las veterinarias donde tenga cita"
            descripcion="Si lo apagas, cada veterinaria ve solo lo que ella registró. Las vacunas, las alergias y las condiciones médicas siempre las ven, por su seguridad."
            activo={field.value}
            onCambiar={field.onChange}
          />
        )}
      />
    </View>
  );
}
