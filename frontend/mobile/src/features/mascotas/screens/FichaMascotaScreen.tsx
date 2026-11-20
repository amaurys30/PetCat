import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, IdCard, Pencil } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Button, Card, ErrorState, SkeletonLista, Text } from "@/components/ui";
import { formatearFecha } from "@/lib/formatos";
import { formatearEdad, formatearPeso, nombreEspecie, nombreSexo, segunSexo } from "@/lib/mascotas";
import { RESPALDO, useVolver } from "@/lib/navegacion";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
import { useIdUsuario } from "@/store/sesion";
import { colors } from "@/theme/tokens";

import { AvisoSinConexion } from "../components/AvisoSinConexion";
import { ChipSalud } from "../components/ChipSalud";
import { GraficoPeso } from "../components/GraficoPeso";
import { useMascota, usePesos, useSoloLectura } from "../hooks";

/** Botón redondo de la cabecera: círculo blanco con ícono primary-deep (contraste en el degradado). */
function BotonCabecera({
  etiqueta,
  icono: Icono,
  onPress,
  deshabilitado,
}: {
  etiqueta: string;
  icono: typeof Pencil;
  onPress: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full bg-white"
        style={{ opacity: deshabilitado ? 0.6 : 1 }}
      >
        <Icono size={22} color={colors["primary-deep"]} />
      </View>
    </Pressable>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View
      className="flex-row justify-between gap-4 border-b border-border py-3"
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
    >
      <Text className="text-muted">{etiqueta}</Text>
      <Text className="flex-1 text-right font-semibold">{valor}</Text>
    </View>
  );
}

/**
 * M6 · Ficha de la mascota (pestaña Resumen). Historial y Documentos llegan en M3, así que el
 * selector de pestañas aún no se muestra. "Tamaño" no existe en la API: no se muestra.
 */
export function FichaMascotaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const id_mascota = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const volver = useVolver(RESPALDO.inicio);
  const soloLectura = useSoloLectura();
  const id_usuario = useIdUsuario();
  const seleccionar = useMascotaSeleccionada((s) => s.seleccionar);
  const mascota = useMascota(id_mascota);
  const pesos = usePesos(id_mascota);

  if (mascota.isPending)
    return (
      <View className="flex-1 bg-surface pt-24">
        <SkeletonLista filas={3} etiqueta="Cargando la ficha" />
      </View>
    );
  if (!mascota.data) {
    return (
      <View className="flex-1 justify-center bg-surface">
        <ErrorState
          error={mascota.error}
          onReintentar={() => mascota.refetch()}
          reintentando={mascota.isFetching}
        />
        <Button titulo="Volver" variante="secundario" onPress={volver} className="mx-pantalla" />
      </View>
    );
  }

  const m = mascota.data;
  const detalle = [m.raza ?? nombreEspecie(m.especie), m.sexo !== "desconocido" ? nombreSexo(m.sexo) : null]
    .filter(Boolean)
    .join(" · ");
  const datos = [
    { etiqueta: "Edad", valor: formatearEdad(m.edad_meses) ?? "Sin fecha" },
    { etiqueta: "Peso", valor: formatearPeso(m.peso) ?? "Sin registro" },
    { etiqueta: "Sexo", valor: m.sexo === "desconocido" ? "Sin registrar" : nombreSexo(m.sexo) },
  ];
  const clave = [
    { etiqueta: "Especie", valor: nombreEspecie(m.especie) },
    m.fecha_nacimiento && {
      etiqueta: "Nacimiento",
      valor: formatearFecha(m.fecha_nacimiento, { anio: true }),
    },
    { etiqueta: "Microchip", valor: m.microchip ?? "Sin registrar" },
    { etiqueta: "Alergias", valor: m.tiene_alergias ? (m.alergias_detalle ?? "Sí") : "Ninguna registrada" },
    { etiqueta: "Condiciones médicas", valor: m.condiciones_medicas ?? "Ninguna registrada" },
    { etiqueta: segunSexo(m.sexo, "Esterilizado", "Esterilizada"), valor: m.esterilizado ? "Sí" : "No" },
    m.color && { etiqueta: "Color", valor: m.color },
    m.tipo_sangre && { etiqueta: "Tipo de sangre", valor: m.tipo_sangre },
    m.numero_registro && { etiqueta: "Número de registro", valor: m.numero_registro },
    {
      etiqueta: "Historial con veterinarias",
      valor: m.compartir_historial ? "Compartido" : "Cada una ve solo lo suyo",
    },
  ].filter(Boolean) as { etiqueta: string; valor: string }[];

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 32 }}>
      <LinearGradient
        colors={[colors["primary-strong"], colors["primary-deep"]]}
        style={{ paddingTop: insets.top + 4, paddingBottom: 56, paddingHorizontal: 12 }}
      >
        <View className="flex-row justify-between">
          <BotonCabecera etiqueta="Volver" icono={ChevronLeft} onPress={volver} />
          <BotonCabecera
            etiqueta={soloLectura ? "Editar (necesita conexión)" : `Editar a ${m.nombre}`}
            icono={Pencil}
            deshabilitado={soloLectura}
            onPress={() => router.push(`/mascotas/${id_mascota}/editar`)}
          />
        </View>
        <View className="items-center gap-2">
          <View className="rounded-full bg-white p-1">
            <Avatar nombre={m.nombre} uri={m.foto_url} especie={m.especie} tamano="lg" />
          </View>
          <Text variante="titulo" className="text-center text-white">
            {m.nombre}
          </Text>
          {detalle ? <Text className="text-center text-white">{detalle}</Text> : null}
          {m.fallecido ? (
            <View className="rounded-full bg-white px-3 py-1.5">
              <Text variante="apoyo" className="font-bold text-lavender-ink">
                {m.fecha_fallecimiento
                  ? `En memoria · ${formatearFecha(m.fecha_fallecimiento, { anio: true })}`
                  : "En memoria"}
              </Text>
            </View>
          ) : (
            <ChipSalud estado={m.resumen?.estado_vacunas ?? null} sobreColor />
          )}
        </View>
      </LinearGradient>

      <View className="-mt-10 gap-4 px-pantalla">
        <Card className="flex-row justify-around">
          {datos.map((d) => (
            <View
              key={d.etiqueta}
              accessible
              accessibilityLabel={`${d.etiqueta}: ${d.valor}`}
              className="items-center gap-0.5"
            >
              <Text variante="seccion">{d.valor}</Text>
              <Text variante="apoyo" className="text-muted">
                {d.etiqueta}
              </Text>
            </View>
          ))}
        </Card>

        <AvisoSinConexion />

        {!m.fallecido && (
          <Button
            titulo="Abrir su Pasaporte PetCat"
            accessibilityLabel={`Abrir el Pasaporte PetCat de ${m.nombre}`}
            icono={IdCard}
            onPress={() => {
              if (id_usuario) seleccionar(id_usuario, id_mascota);
              router.navigate("/carnet");
            }}
          />
        )}

        <GraficoPeso
          puntos={pesos.data?.puntos}
          cargando={pesos.isPending}
          error={pesos.error}
          onReintentar={() => pesos.refetch()}
        />

        <Card>
          <Text variante="seccion" className="mb-1">
            Datos clave
          </Text>
          {clave.map((d) => (
            <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}
