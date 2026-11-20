import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import {
  Crosshair,
  List,
  Map as IconoMapa,
  MapPin,
  Scissors,
  Search,
  Stethoscope,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Alert, FlatList, Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getNegocios } from "@/api/negocios";
import { Aviso, Button, Chip, EmptyState, ErrorState, Input, SkeletonLista, Text } from "@/components/ui";
import { queryKeys } from "@/lib/queryKeys";
import { colors } from "@/theme/tokens";

import { ExplicarUbicacion } from "./components/ExplicarUbicacion";
import { TarjetaNegocio } from "./components/TarjetaNegocio";
import { CENTRO_SINCELEJO, etiquetaNegocio, pinesDe, tiposDeFiltros, type Filtros } from "./logica";
import { MapaNegocios, type EstadoMapa } from "./mapa/MapaNegocios";
import { useUbicacion } from "./ubicacion";

const ESPERA_BUSQUEDA_MS = 400;
/** Redondea a ~100 m: moverse un poco no repite la búsqueda. */
const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** El texto con espera: no se busca en cada letra. */
function useConEspera<T>(valor: T, ms: number): T {
  const [conEspera, setConEspera] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setConEspera(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return conEspera;
}

/**
 * M10 · Explorar: mapa (Leaflet en un WebView, ver features/explorar/mapa) con los negocios
 * cercanos, búsqueda, filtros y "Ver lista". La lista es la alternativa accesible y también lo
 * que se ve si el mapa no carga. Sin la ubicación del teléfono, centra en Sincelejo.
 */
export function ExplorarScreen() {
  const insets = useSafeAreaInsets();
  const ubicacion = useUbicacion();
  const [texto, setTexto] = useState("");
  const q = useConEspera(texto.trim(), ESPERA_BUSQUEDA_MS);
  const [filtros, setFiltros] = useState<Filtros>({
    abiertoAhora: false,
    veterinarias: false,
    peluqueria: false,
  });
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");
  const [estadoMapa, setEstadoMapa] = useState<EstadoMapa>("cargando");
  const [intentoMapa, setIntentoMapa] = useState(0);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [explicando, setExplicando] = useState(false);
  const [yaExplicado, setYaExplicado] = useState(false);
  const [centrarManual, setCentrarManual] = useState<{ lat: number; lng: number; clave: number } | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("dark");
    }, []),
  );

  // La primera vez, explicar para qué es la ubicación antes de que el teléfono la pida.
  const mostrarExplicacion = explicando || (ubicacion.permiso === "pendiente" && !yaExplicado);

  const real = ubicacion.coordenada;
  const centro = real ?? CENTRO_SINCELEJO;
  const busqueda = {
    q,
    tipos: tiposDeFiltros(filtros),
    abiertoAhora: filtros.abiertoAhora,
    lat: redondear(centro.lat),
    lng: redondear(centro.lng),
  };
  const negocios = useQuery({
    queryKey: queryKeys.negocios.busqueda(busqueda),
    queryFn: () => getNegocios(busqueda),
    placeholderData: keepPreviousData,
    enabled: ubicacion.permiso !== "verificando",
  });

  const lista = useMemo(() => negocios.data?.negocios ?? [], [negocios.data]);
  const pines = useMemo(() => pinesDe(lista), [lista]);
  const elegido = lista.find((n) => n.id_negocio === seleccionado) ?? null;
  const mapaFallo = estadoMapa === "error" || estadoMapa === "sin_teselas";
  const verLista = vista === "lista" || mapaFallo;

  // Cuando llega la ubicación, el mapa se centra ahí (salvo que se haya centrado con el botón).
  const centrar = useMemo(
    () => centrarManual ?? (real ? { ...real, clave: 0 } : null),
    [centrarManual, real],
  );

  const elegir = (id: number | null) => {
    setSeleccionado(id);
    const n = lista.find((x) => x.id_negocio === id);
    if (n) AccessibilityInfo.announceForAccessibility(etiquetaNegocio(n, !!real));
  };

  const usarUbicacion = async () => {
    setExplicando(false);
    setYaExplicado(true);
    const estado = await ubicacion.pedir();
    if (estado !== "concedido")
      AccessibilityInfo.announceForAccessibility("Sin tu ubicación: mostramos Sincelejo");
  };

  const botonUbicacion = () => {
    if (ubicacion.permiso === "concedido") {
      if (real) setCentrarManual({ ...real, clave: Date.now() });
      void ubicacion.actualizar();
    } else if (ubicacion.permiso === "bloqueado") {
      Alert.alert(
        "Ubicación desactivada",
        "Para ver lo que está cerca, activa la ubicación para PetCat en Ajustes.",
        [
          { text: "Ahora no", style: "cancel" },
          { text: "Abrir Ajustes", onPress: () => void Linking.openSettings() },
        ],
      );
    } else {
      setExplicando(true);
    }
  };

  const alternarFiltro = (clave: keyof Filtros) => {
    setFiltros((f) => ({ ...f, [clave]: !f[clave] }));
    setSeleccionado(null);
  };

  const cabecera = (
    <View className="gap-3 px-pantalla pb-3" style={{ paddingTop: insets.top + 8 }}>
      <Input
        etiqueta="Buscar"
        placeholder="Busca veterinarias, peluquerías…"
        icono={Search}
        value={texto}
        onChangeText={setTexto}
        returnKeyType="search"
        autoCorrect={false}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        <Chip
          etiqueta="Abierto ahora"
          seleccionado={filtros.abiertoAhora}
          onPress={() => alternarFiltro("abiertoAhora")}
        />
        <Chip
          etiqueta="Veterinarias"
          icono={Stethoscope}
          seleccionado={filtros.veterinarias}
          onPress={() => alternarFiltro("veterinarias")}
        />
        <Chip
          etiqueta="Peluquería"
          icono={Scissors}
          seleccionado={filtros.peluqueria}
          onPress={() => alternarFiltro("peluqueria")}
        />
      </ScrollView>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {mapaFallo ? null : (
          <Button
            titulo={vista === "mapa" ? "Ver lista" : "Ver mapa"}
            variante="secundario"
            icono={vista === "mapa" ? List : IconoMapa}
            onPress={() => setVista(vista === "mapa" ? "lista" : "mapa")}
          />
        )}
        {!real && ubicacion.permiso !== "verificando" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mostrando Sincelejo. Usar mi ubicación"
            onPress={botonUbicacion}
            className="min-h-12 flex-row items-center gap-1"
          >
            <MapPin size={16} color={colors["primary-strong"]} />
            <Text variante="apoyo" className="font-bold text-primary-strong">
              Mostrando Sincelejo · Usar mi ubicación
            </Text>
          </Pressable>
        )}
      </View>
      {mapaFallo && (
        <Aviso
          tono="consejo"
          accion={
            <Button
              titulo="Reintentar mapa"
              variante="secundario"
              onPress={() => {
                setEstadoMapa("cargando");
                setIntentoMapa((n) => n + 1);
                setVista("mapa");
              }}
            />
          }
        >
          {estadoMapa === "sin_teselas"
            ? "El mapa no pudo cargar sus imágenes. Te mostramos la lista."
            : "No pudimos cargar el mapa. Te mostramos la lista."}
        </Aviso>
      )}
    </View>
  );

  const vacio = (
    <EmptyState
      icono={Search}
      titulo="No encontramos negocios"
      descripcion={
        filtros.abiertoAhora || filtros.veterinarias || filtros.peluqueria || q
          ? "Prueba con otros filtros o con otra búsqueda."
          : "No hay negocios cerca todavía."
      }
    />
  );

  return (
    <View className="flex-1 bg-surface">
      {cabecera}

      {negocios.isError && !negocios.data ? (
        <ErrorState
          error={negocios.error}
          onReintentar={() => negocios.refetch()}
          reintentando={negocios.isFetching}
        />
      ) : verLista ? (
        negocios.isPending ? (
          <SkeletonLista filas={3} etiqueta="Buscando negocios" />
        ) : (
          <FlatList
            data={lista}
            keyExtractor={(n) => String(n.id_negocio)}
            contentContainerClassName="gap-3 px-pantalla pb-8"
            renderItem={({ item }) => <TarjetaNegocio negocio={item} conDistancia={!!real} />}
            ListEmptyComponent={vacio}
          />
        )
      ) : (
        <View className="flex-1">
          <MapaNegocios
            key={intentoMapa}
            pines={pines}
            seleccionado={seleccionado}
            centro={centro}
            centrar={centrar}
            miUbicacion={real}
            onSeleccionar={elegir}
            onEstado={setEstadoMapa}
            descripcion={`Mapa con ${pines.length} ${pines.length === 1 ? "negocio" : "negocios"}. Para recorrerlos con el lector de pantalla, usa Ver lista.`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              ubicacion.permiso === "concedido" ? "Centrar en mi ubicación" : "Activar mi ubicación"
            }
            onPress={botonUbicacion}
            className="absolute right-4 top-4 h-12 w-12 items-center justify-center rounded-2xl bg-white"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <Crosshair size={22} color={colors.info} />
          </Pressable>
          {negocios.isFetching && (
            <View
              className="absolute left-4 top-4 rounded-full bg-white px-3 py-2"
              accessibilityLiveRegion="polite"
            >
              <Text variante="apoyo">Buscando…</Text>
            </View>
          )}
          <View className="absolute inset-x-0 bottom-0 px-pantalla pb-4">
            {elegido ? (
              <TarjetaNegocio negocio={elegido} conDistancia={!!real} />
            ) : !negocios.isPending && lista.length === 0 ? (
              <View className="rounded-card bg-white">{vacio}</View>
            ) : null}
          </View>
        </View>
      )}

      <ExplicarUbicacion
        visible={mostrarExplicacion}
        onUsar={() => void usarUbicacion()}
        onAhoraNo={() => {
          setExplicando(false);
          setYaExplicado(true);
        }}
      />
    </View>
  );
}
