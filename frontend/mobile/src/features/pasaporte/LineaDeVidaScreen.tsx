import { useLocalSearchParams } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  Hourglass,
  CircleAlert,
  Pill,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";

import { ApiError } from "@/api/errors";
import type { EventoSalud } from "@/api/types";
import {
  Aviso,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ScreenHeader,
  SkeletonLista,
  Text,
} from "@/components/ui";
import { AvisoSinConexion } from "@/features/mascotas/components/AvisoSinConexion";
import { useMascota } from "@/features/mascotas/hooks";
import { formatearFecha } from "@/lib/formatos";
import { textoPlazo, tituloEvento } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

import { useHistorial, useUltimaDesparasitacion, useVacunas } from "./hooks";
import { construirLinea, etiquetaItem, type FiltroLinea, type ItemLinea } from "./logica";

const FILTROS: { valor: FiltroLinea; etiqueta: string }[] = [
  { valor: "todo", etiqueta: "Todo" },
  { valor: "vacunas", etiqueta: "Vacunas" },
  { valor: "desparasitacion", etiqueta: "Desparasitación" },
  { valor: "consultas", etiqueta: "Consultas" },
];

const CLASE: Record<ItemLinea["clase"], { icono: LucideIcon; fondo: string; color: string }> = {
  vacuna: { icono: Syringe, fondo: colors["primary-soft"], color: colors["primary-deep"] },
  desparasitacion: { icono: Pill, fondo: colors["lavender-soft"], color: colors["lavender-ink"] },
  consulta: { icono: Stethoscope, fondo: colors["info-soft"], color: colors["info-ink"] },
};

/** "14 OCT 2025" (sin el día de la semana). */
const fechaCorta = (fecha: string) =>
  formatearFecha(fecha, { anio: true }).replace(/^\S+ /, "").toLocaleUpperCase("es-CO");

function Insignia({
  texto,
  fondo,
  color,
  icono: Icono,
}: {
  texto: string;
  fondo: string;
  color: string;
  icono?: LucideIcon;
}) {
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-3 py-1"
      style={{ backgroundColor: fondo }}
    >
      {Icono && <Icono size={14} color={color} />}
      <Text variante="apoyo" className="font-bold" style={{ color }}>
        {texto}
      </Text>
    </View>
  );
}

function Registro({ item }: { item: ItemLinea }) {
  const [abierto, setAbierto] = useState(false);
  const clase = CLASE[item.clase];
  const Icono = clase.icono;
  const expandible = item.extra.length > 0;
  const estado =
    item.estado === "Atendida"
      ? { fondo: colors["info-soft"], color: colors["info-ink"] }
      : { fondo: colors["primary-soft"], color: colors["primary-deep"] };

  const contenido = (
    <View className="flex-row gap-4 px-pantalla py-3">
      <View
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: clase.fondo }}
      >
        <Icono size={22} color={clase.color} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text variante="apoyo" className="font-bold text-muted">
            {fechaCorta(item.fecha)}
          </Text>
          <Insignia texto={`✓ ${item.estado}`} {...estado} />
        </View>
        <Text variante="seccion">{item.titulo}</Text>
        {item.detalle ? <Text className="text-muted">{item.detalle}</Text> : null}
        {abierto && (
          <View className="mt-2 gap-2 rounded-control bg-surface p-3">
            {item.extra.map((e) => (
              <View key={e.etiqueta} className="gap-0.5">
                <Text variante="apoyo" className="font-bold text-muted">
                  {e.etiqueta}
                </Text>
                <Text>{e.valor}</Text>
              </View>
            ))}
          </View>
        )}
        {expandible && (
          <View className="flex-row items-center gap-1">
            {abierto ? (
              <ChevronUp size={16} color={colors["primary-strong"]} />
            ) : (
              <ChevronDown size={16} color={colors["primary-strong"]} />
            )}
            <Text variante="apoyo" className="font-bold text-primary-strong">
              {abierto ? "Ocultar detalle" : "Ver detalle"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (!expandible) {
    return (
      <View accessible accessibilityLabel={etiquetaItem(item)}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaItem(item)}
      accessibilityState={{ expanded: abierto }}
      accessibilityHint={
        abierto ? "Oculta el detalle" : "Muestra el diagnóstico, el tratamiento y las indicaciones"
      }
      onPress={() => setAbierto((a) => !a)}
      className="active:bg-track"
    >
      {contenido}
    </Pressable>
  );
}

function Proximo({ eventos }: { eventos: EventoSalud[] }) {
  return (
    <View className="gap-2">
      <View className="px-pantalla">
        <Insignia texto="PRÓXIMO" fondo={colors["sun-soft"]} color={colors["sun-ink"]} />
      </View>
      {eventos.map((e) => {
        const vencido = e.dias < 0;
        const plazo = textoPlazo(e.dias);
        return (
          <View
            key={`${e.tipo}-${e.id_vacuna ?? e.id_historial}-${e.fecha}`}
            accessible
            accessibilityLabel={`${tituloEvento(e)}. ${vencido ? "Vencida" : "Pendiente"}. ${plazo}, ${formatearFecha(e.fecha, { anio: true })}.`}
            className="flex-row gap-4 px-pantalla py-3"
          >
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: vencido ? colors["danger-soft"] : colors["sun-soft"] }}
            >
              {vencido ? (
                <CircleAlert size={22} color={colors["danger-ink"]} />
              ) : (
                <Hourglass size={22} color={colors["sun-ink"]} />
              )}
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text variante="apoyo" className="font-bold text-muted">
                  {fechaCorta(e.fecha)}
                </Text>
                {vencido ? (
                  <Insignia
                    texto="Vencida"
                    fondo={colors["danger-soft"]}
                    color={colors["danger-ink"]}
                    icono={CircleAlert}
                  />
                ) : (
                  <Insignia
                    texto="Pendiente"
                    fondo={colors["sun-soft"]}
                    color={colors["sun-ink"]}
                    icono={Hourglass}
                  />
                )}
              </View>
              <Text variante="seccion">{tituloEvento(e)}</Text>
              <Text className="text-muted">{plazo}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * M8 · Línea de vida: vacunas, desparasitaciones y consultas, del más reciente al más antiguo,
 * con "Próximo" arriba y separadores por año. El historial se pagina (20 por página).
 * Sin red: vacunas y la última desparasitación (guardadas en el teléfono); las consultas no se
 * guardan (datos de salud, Ley 1581) y se avisa.
 */
export function LineaDeVidaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const id_mascota = Number(id);
  const [filtro, setFiltro] = useState<FiltroLinea>("todo");
  const mascota = useMascota(id_mascota);
  const vacunas = useVacunas(id_mascota);
  const desparasitacion = useUltimaDesparasitacion(id_mascota);
  const historial = useHistorial(id_mascota, filtro);

  const usaHistorial = filtro !== "vacunas";
  const sinHistorial = usaHistorial && historial.isError && !historial.data;
  const registros = useMemo(() => {
    if (!usaHistorial) return [];
    if (historial.data) return historial.data.pages.flatMap((p) => p.registros);
    // Sin el historial (sin red): al menos la última desparasitación guardada.
    if (sinHistorial && filtro !== "consultas" && desparasitacion.data) return [desparasitacion.data];
    return [];
  }, [usaHistorial, historial.data, sinHistorial, filtro, desparasitacion.data]);

  const filas = useMemo(
    () =>
      construirLinea({
        filtro,
        vacunas: vacunas.data ?? [],
        registros,
        hayMas: !!historial.hasNextPage && !sinHistorial,
      }),
    [filtro, vacunas.data, registros, historial.hasNextPage, sinHistorial],
  );

  const nombre = mascota.data?.nombre ?? "";
  const eventos =
    mascota.data && !mascota.data.fallecido ? (mascota.data.resumen?.proximos_eventos ?? []) : [];
  const cargando = vacunas.isPending || (usaHistorial && historial.isPending && !sinHistorial);
  const errorVacunas = vacunas.isError && !vacunas.data;
  const sinConexion = historial.error instanceof ApiError && historial.error.sinConexion;

  const cabecera = (
    <View className="gap-4 pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-pantalla"
      >
        {FILTROS.map((f) => (
          <Chip
            key={f.valor}
            etiqueta={f.etiqueta}
            seleccionado={filtro === f.valor}
            onPress={() => setFiltro(f.valor)}
          />
        ))}
      </ScrollView>
      <AvisoSinConexion />
      {sinHistorial && (
        <View className="px-pantalla">
          <Aviso
            tono="error"
            accion={<Button titulo="Reintentar" variante="secundario" onPress={() => historial.refetch()} />}
          >
            {sinConexion
              ? "Sin conexión: las consultas necesitan conexión. Mostramos las vacunas y la última desparasitación guardadas."
              : "No pudimos cargar las consultas y desparasitaciones."}
          </Aviso>
        </View>
      )}
      {filtro === "todo" && eventos.length > 0 && <Proximo eventos={eventos} />}
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        titulo="Línea de vida"
        subtitulo={nombre ? `${nombre} · todo su historial de salud` : undefined}
        volverA={`/mascotas/${id_mascota}`}
      />
      {cargando ? (
        <>
          {cabecera}
          <SkeletonLista filas={4} etiqueta="Cargando la línea de vida" />
        </>
      ) : errorVacunas ? (
        <>
          {cabecera}
          <ErrorState
            error={vacunas.error}
            onReintentar={() => vacunas.refetch()}
            reintentando={vacunas.isFetching}
          />
        </>
      ) : (
        <FlatList
          data={filas}
          keyExtractor={(f) => (f.tipo === "anio" ? `anio-${f.anio}` : f.item.clave)}
          ListHeaderComponent={cabecera}
          contentContainerStyle={{ paddingBottom: 32 }}
          onEndReached={() =>
            historial.hasNextPage && !historial.isFetchingNextPage && historial.fetchNextPage()
          }
          onEndReachedThreshold={0.4}
          renderItem={({ item: f }) =>
            f.tipo === "anio" ? (
              <View className="px-pantalla pb-1 pt-4">
                <View className="self-start rounded-chip bg-track px-3 py-1">
                  <Text variante="apoyo" className="font-bold text-muted" accessibilityRole="header">
                    {f.anio}
                  </Text>
                </View>
              </View>
            ) : (
              <Registro item={f.item} />
            )
          }
          ListEmptyComponent={
            sinHistorial ? undefined : (
              <EmptyState
                icono={Syringe}
                titulo="Todavía no hay registros"
                descripcion="Las vacunas, desparasitaciones y consultas que registre tu veterinaria en PetCat aparecerán aquí."
              />
            )
          }
          ListFooterComponent={
            historial.hasNextPage && !sinHistorial ? (
              <View className="px-pantalla pt-2">
                <Button
                  titulo="Cargar más"
                  variante="secundario"
                  cargando={historial.isFetchingNextPage}
                  onPress={() => historial.fetchNextPage()}
                />
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
