import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { BadgeCheck, ChevronLeft, Globe, MessageCircle, Navigation, Phone, Star } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getNegocio, getResenas } from "@/api/negocios";
import type { NegocioPublico, ResenaPublica, SucursalPublica } from "@/api/types";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Segmented,
  SkeletonLista,
  Text,
} from "@/components/ui";
import { formatearDinero, formatearFecha } from "@/lib/formatos";
import { RESPALDO, useVolver } from "@/lib/navegacion";
import { queryKeys } from "@/lib/queryKeys";
import { colors } from "@/theme/tokens";

import { comoLlegar } from "./components/TarjetaNegocio";
import {
  aperturaDeSede,
  categoriaDe,
  distanciaKm,
  formatearCalificacion,
  formatearDistancia,
  horarioSemanal,
  nombreTipo,
  precioDesde,
  textoApertura,
  textoDuracion,
  textoPrecio,
} from "./logica";
import { useUbicacion } from "./ubicacion";

type Pestana = "servicios" | "resenas" | "informacion";

const DEGRADADO = {
  veterinaria: [colors["primary-strong"], colors["primary-deep"]],
  peluqueria: [colors["coral-dark"], colors["passport-to"]],
  tienda: [colors["lavender-ink"], colors["passport-to"]],
  otro: [colors["primary-deep"], colors["passport-to"]],
} as const;

/** "Sofía G., 5 de 5 estrellas" en texto; las estrellas son decorativas. */
function Estrellas({ valor }: { valor: number }) {
  return (
    <View
      className="flex-row gap-0.5"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} color={colors["sun-ink"]} fill={i <= valor ? colors.sun : "transparent"} />
      ))}
    </View>
  );
}

function Resena({ r }: { r: ResenaPublica }) {
  const etiqueta = [
    `${r.autor}, ${r.calificacion} de 5 estrellas, ${formatearFecha(r.fecha_creacion, { anio: true })}.`,
    r.titulo,
    r.comentario,
    r.respuesta ? `Respuesta del negocio: ${r.respuesta.texto}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Card className="gap-2" accessibilityLabel={etiqueta}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-bold">{r.autor}</Text>
        <Text variante="apoyo" className="text-muted">
          {formatearFecha(r.fecha_creacion, { anio: true })}
        </Text>
      </View>
      <Estrellas valor={r.calificacion} />
      {r.titulo ? <Text className="font-bold">{r.titulo}</Text> : null}
      {r.comentario ? <Text>{r.comentario}</Text> : null}
      {r.respuesta && (
        <View className="gap-1 rounded-control bg-surface p-3">
          <Text variante="apoyo" className="font-bold text-muted">
            Respuesta del negocio
          </Text>
          <Text variante="apoyo">{r.respuesta.texto}</Text>
        </View>
      )}
    </Card>
  );
}

function Resenas({ negocio }: { negocio: NegocioPublico }) {
  const resenas = useInfiniteQuery({
    queryKey: queryKeys.negocios.resenas(negocio.id_negocio),
    queryFn: ({ pageParam }) => getResenas(negocio.id_negocio, pageParam),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.meta.hasNext ? ultima.meta.page + 1 : undefined),
  });
  if (resenas.isPending) return <SkeletonLista filas={2} etiqueta="Cargando reseñas" />;
  if (resenas.isError) return <ErrorState error={resenas.error} onReintentar={() => resenas.refetch()} />;
  const lista = resenas.data.pages.flatMap((p) => p.resenas);
  if (lista.length === 0)
    return (
      <EmptyState
        icono={Star}
        titulo="Aún no tiene reseñas"
        descripcion="Las reseñas son de clientes que ya tuvieron una cita."
      />
    );
  return (
    <View className="gap-3">
      {lista.map((r) => (
        <Resena key={r.id_resena} r={r} />
      ))}
      {resenas.hasNextPage && (
        <Button
          titulo="Cargar más"
          variante="secundario"
          cargando={resenas.isFetchingNextPage}
          onPress={() => resenas.fetchNextPage()}
        />
      )}
    </View>
  );
}

const soloDigitos = (t: string) => t.replace(/\D/g, "");
/** WhatsApp con indicativo de Colombia si llega un celular de 10 dígitos. */
const enlaceWhatsapp = (numero: string) => {
  const d = soloDigitos(numero);
  return `https://wa.me/${d.length === 10 ? `57${d}` : d}`;
};

function Sede({ sede, nombreNegocio }: { sede: SucursalPublica; nombreNegocio: string }) {
  const apertura = aperturaDeSede(sede.horarios);
  return (
    <Card className="gap-3">
      <View accessible className="gap-1">
        <Text className="font-bold">{sede.es_principal ? `${sede.nombre} (principal)` : sede.nombre}</Text>
        <Text className="text-muted">{`${sede.direccion}, ${sede.ciudad}`}</Text>
        <Text
          variante="apoyo"
          className="font-bold"
          style={{ color: apertura.abierto_ahora ? colors["primary-deep"] : colors.muted }}
        >
          {textoApertura(apertura)}
        </Text>
      </View>
      <View className="gap-1">
        {horarioSemanal(sede.horarios).map((d) => (
          <View
            key={d.dia}
            accessible
            accessibilityLabel={`${d.dia}: ${d.texto}`}
            className="flex-row justify-between gap-3"
          >
            <Text variante="apoyo" className="text-muted">
              {d.dia}
            </Text>
            <Text variante="apoyo" className="flex-1 text-right">
              {d.texto}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {sede.latitud !== null && sede.longitud !== null && (
          <Button
            titulo="Cómo llegar"
            variante="suave"
            icono={Navigation}
            accessibilityLabel={`Cómo llegar a ${sede.nombre}`}
            onPress={() =>
              comoLlegar(`${nombreNegocio}, ${sede.nombre}`, { lat: sede.latitud!, lng: sede.longitud! })
            }
          />
        )}
        {sede.telefono && (
          <Button
            titulo="Llamar"
            variante="suave"
            icono={Phone}
            accessibilityLabel={`Llamar a ${sede.nombre}`}
            onPress={() => void Linking.openURL(`tel:${soloDigitos(sede.telefono!)}`)}
          />
        )}
      </View>
    </Card>
  );
}

/**
 * M11 · Perfil del negocio (público): servicios con precio, reseñas e información (sedes con su
 * horario, cómo llegar y contacto). Agendar llega en M5: el botón está, deshabilitado.
 */
export function PerfilNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const id_negocio = Number(id);
  const insets = useSafeAreaInsets();
  const volver = useVolver(RESPALDO.inicio);
  const [pestana, setPestana] = useState<Pestana>("servicios");
  const negocio = useQuery({
    queryKey: queryKeys.negocios.perfil(id_negocio),
    queryFn: () => getNegocio(id_negocio),
  });
  const { coordenada } = useUbicacion();

  const n = negocio.data;
  const principal = n?.sucursales[0];
  const apertura = useMemo(() => (principal ? aperturaDeSede(principal.horarios) : null), [principal]);
  // Distancia "de ti" solo con la ubicación del teléfono (ya concedida; aquí no se pide).
  const distancia = useMemo(() => {
    if (!coordenada || !n) return null;
    const con = n.sucursales.filter((s) => s.latitud !== null && s.longitud !== null);
    return con.length
      ? Math.min(...con.map((s) => distanciaKm(coordenada, { lat: s.latitud!, lng: s.longitud! })))
      : null;
  }, [coordenada, n]);

  if (negocio.isPending) {
    return (
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top + 48 }}>
        <SkeletonLista filas={3} etiqueta="Cargando el negocio" />
      </View>
    );
  }
  if (!n) {
    return (
      <View className="flex-1 justify-center bg-surface">
        <ErrorState
          error={negocio.error}
          onReintentar={() => negocio.refetch()}
          reintentando={negocio.isFetching}
        />
        <Button titulo="Volver" variante="secundario" onPress={volver} className="mx-pantalla" />
      </View>
    );
  }

  const desde = precioDesde(n.servicios);
  const direccion = principal ? `${principal.direccion}, ${principal.ciudad}` : (n.direccion ?? n.ciudad);
  const resumen = [
    n.total_resenas > 0
      ? `${formatearCalificacion(n.calificacion_promedio)} estrellas, ${n.total_resenas} reseñas`
      : "Sin reseñas todavía",
    distancia !== null ? `a ${formatearDistancia(distancia)} de ti` : null,
    apertura ? textoApertura(apertura) : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <LinearGradient
          colors={DEGRADADO[categoriaDe(n.tipo)]}
          style={{ paddingTop: insets.top + 4, paddingBottom: 64, paddingHorizontal: 12 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={volver}
            className="h-12 w-12 items-center justify-center"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
              <ChevronLeft size={22} color={colors["primary-deep"]} />
            </View>
          </Pressable>
        </LinearGradient>

        <View className="-mt-12 gap-4 px-pantalla">
          <Card className="gap-3">
            <View className="flex-row items-center gap-3">
              <Avatar nombre={n.nombre} uri={n.logo_miniatura_url} tamano="lg" />
              <View className="flex-1 gap-1">
                <Text variante="titulo" accessibilityRole="header">
                  {n.nombre}
                </Text>
                {n.verificado && (
                  <View className="flex-row items-center gap-1">
                    <BadgeCheck size={16} color={colors["primary-deep"]} />
                    <Text variante="apoyo" className="font-bold text-primary-deep">
                      Verificado por PetCat
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text className="text-muted">{`${nombreTipo(n.tipo)} · ${direccion}`}</Text>
            <View accessible accessibilityLabel={resumen} className="flex-row flex-wrap gap-x-6 gap-y-2">
              <View>
                <View className="flex-row items-center gap-1">
                  <Star size={16} color={colors["sun-ink"]} fill={colors.sun} />
                  <Text variante="seccion">
                    {n.total_resenas > 0 ? formatearCalificacion(n.calificacion_promedio) : "–"}
                  </Text>
                </View>
                <Text
                  variante="apoyo"
                  className="text-muted"
                >{`${n.total_resenas} ${n.total_resenas === 1 ? "reseña" : "reseñas"}`}</Text>
              </View>
              {distancia !== null && (
                <View>
                  <Text variante="seccion">{formatearDistancia(distancia)}</Text>
                  <Text variante="apoyo" className="text-muted">
                    de ti
                  </Text>
                </View>
              )}
              {apertura && (
                <View className="flex-1">
                  <Text
                    variante="seccion"
                    style={{ color: apertura.abierto_ahora ? colors["primary-deep"] : colors.muted }}
                  >
                    {apertura.abierto_ahora ? "Abierto" : "Cerrado"}
                  </Text>
                  <Text variante="apoyo" className="text-muted">
                    {textoApertura(apertura).replace(/^(Abierto|Cerrado)( · )?/, "") || " "}
                  </Text>
                </View>
              )}
            </View>
          </Card>

          <Segmented
            etiqueta="Secciones del negocio"
            valor={pestana}
            onCambiar={setPestana}
            opciones={[
              { valor: "servicios", etiqueta: "Servicios" },
              { valor: "resenas", etiqueta: "Reseñas" },
              { valor: "informacion", etiqueta: "Información" },
            ]}
          />

          {pestana === "servicios" &&
            (n.servicios.length === 0 ? (
              <EmptyState
                icono={Star}
                titulo="Sin servicios publicados"
                descripcion="Este negocio aún no publicó sus servicios en la app."
              />
            ) : (
              <View className="gap-3">
                {n.servicios.map((s) => {
                  const etiqueta = [
                    s.nombre,
                    textoDuracion(s.duracion_minutos),
                    textoPrecio(s),
                    s.oferta_vigente ? `En oferta, antes ${formatearDinero(s.precio_base)}` : null,
                    s.reservable ? null : "Sin reserva en línea",
                  ]
                    .filter(Boolean)
                    .join(". ");
                  return (
                    <Card
                      key={s.id_servicio}
                      accessibilityLabel={etiqueta}
                      className="flex-row items-center gap-3"
                    >
                      <View className="flex-1 gap-0.5">
                        <Text className="font-bold">{s.nombre}</Text>
                        <Text variante="apoyo" className="text-muted">
                          {[s.categoria, textoDuracion(s.duracion_minutos)].join(" · ")}
                        </Text>
                        {!s.reservable && (
                          <Text variante="apoyo" className="text-muted">
                            Sin reserva en línea
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        <Text className="font-bold">{textoPrecio(s)}</Text>
                        {s.oferta_vigente && (
                          <Text
                            variante="apoyo"
                            className="text-muted"
                            style={{ textDecorationLine: "line-through" }}
                          >
                            {formatearDinero(s.precio_base)}
                          </Text>
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            ))}

          {pestana === "resenas" && <Resenas negocio={n} />}

          {pestana === "informacion" && (
            <View className="gap-3">
              {n.descripcion ? (
                <Card>
                  <Text>{n.descripcion}</Text>
                </Card>
              ) : null}
              {n.sucursales.map((s) => (
                <Sede key={s.id_sucursal} sede={s} nombreNegocio={n.nombre} />
              ))}
              {(n.whatsapp || n.sitio_web) && (
                <View className="flex-row flex-wrap gap-2">
                  {n.whatsapp && (
                    <Button
                      titulo="WhatsApp"
                      variante="suave"
                      icono={MessageCircle}
                      accessibilityLabel={`Escribir por WhatsApp a ${n.nombre}`}
                      onPress={() => void Linking.openURL(enlaceWhatsapp(n.whatsapp!))}
                    />
                  )}
                  {n.sitio_web && (
                    <Button
                      titulo="Sitio web"
                      variante="suave"
                      icono={Globe}
                      accessibilityLabel={`Abrir el sitio web de ${n.nombre}`}
                      onPress={() => void Linking.openURL(n.sitio_web!)}
                    />
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        className="flex-row items-center gap-4 border-t border-border bg-white px-pantalla pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {desde !== null && (
          <View accessible accessibilityLabel={`Desde ${formatearDinero(desde)}`}>
            <Text variante="apoyo" className="text-muted">
              Desde
            </Text>
            <Text variante="seccion">{formatearDinero(desde)}</Text>
          </View>
        )}
        <View className="flex-1">
          <Button
            titulo="Agendar cita · Próximamente"
            accessibilityLabel="Agendar cita. Próximamente"
            disabled
            onPress={() => undefined}
          />
        </View>
      </View>
    </View>
  );
}
