import { useRouter } from "expo-router";
import { Check, PawPrint, Stethoscope } from "lucide-react-native";
import { useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Cita, MascotaConResumen, NegocioPublico, ServicioNegocio } from "@/api/types";
import {
  Avatar,
  Aviso,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ScreenHeader,
  SkeletonLista,
  Text,
} from "@/components/ui";
import { conPunto, textoDuracion, textoPrecio } from "@/features/explorar/logica";
import { hoyEnBogota } from "@/lib/fechas";
import { formatearHora } from "@/lib/formatos";
import { colors, fontFamilies } from "@/theme/tokens";

import { useHorariosLibres, useReprogramar, useReservar } from "./hooks";
import {
  agruparHorarios,
  capitalizar,
  diasParaAgendar,
  errorDeReserva,
  fechaParaLeer,
  fechaYHora,
  horaCorta,
  motivoNoAtiende,
  type ErrorReserva,
} from "./logica";

const DIAS_CORTOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type Props = {
  negocio: NegocioPublico;
  /** Mascotas del dueño (solo para agendar; al reprogramar la mascota es la de la cita). */
  mascotas?: MascotaConResumen[];
  /** Mascota de Inicio, si el servicio la atiende. */
  mascotaPreferida?: number | null;
  servicioInicial?: number;
  /** Reprogramar: servicio, mascota y sede fijos (los de la cita). */
  reprogramar?: Cita;
};

/** Título de sección: lo que cambia (el mes) va a la derecha. */
function Seccion({ titulo, derecha }: { titulo: string; derecha?: string }) {
  return (
    <View className="flex-row items-end justify-between">
      <Text variante="seccion">{titulo}</Text>
      {derecha ? <Text className="font-bold text-primary-deep">{derecha}</Text> : null}
    </View>
  );
}

function OpcionMascota({
  mascota,
  seleccionada,
  motivo,
  onPress,
}: {
  mascota: MascotaConResumen;
  seleccionada: boolean;
  motivo: string | null;
  onPress: () => void;
}) {
  const deshabilitada = motivo !== null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={motivo ? `${mascota.nombre}. ${motivo}` : mascota.nombre}
      accessibilityState={{ checked: seleccionada, disabled: deshabilitada }}
      disabled={deshabilitada}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-2 rounded-card border-2 py-2 pl-2 pr-4"
      style={{
        borderColor: seleccionada ? colors["primary-strong"] : colors.border,
        backgroundColor: seleccionada ? colors["primary-soft"] : deshabilitada ? colors.track : colors.white,
      }}
    >
      <Avatar
        nombre={mascota.nombre}
        uri={mascota.foto_miniatura_url}
        especie={mascota.especie}
        tamano="sm"
      />
      <View>
        <Text
          className="font-bold"
          style={{ color: seleccionada ? colors["primary-deep"] : deshabilitada ? colors.muted : colors.ink }}
        >
          {mascota.nombre}
        </Text>
        {motivo ? (
          <Text variante="apoyo" className="text-muted">
            No disponible
          </Text>
        ) : null}
      </View>
      {seleccionada ? <Check size={18} color={colors["primary-deep"]} accessibilityElementsHidden /> : null}
    </Pressable>
  );
}

/**
 * M12 · Agendar cita (y reprogramar): mascota, servicio, sede (si hay varias), día y hora libre
 * (GET /citas/horarios-libres), con el resumen fijo abajo. Solo se muestran las horas libres;
 * sin horas, el motivo que da la API. Si al confirmar la hora ya se ocupó (409), lo dice y
 * vuelve a pedir las horas libres.
 */
export function FormularioAgenda({
  negocio,
  mascotas,
  mascotaPreferida,
  servicioInicial,
  reprogramar,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reservar = useReservar();
  const cambiar = useReprogramar(reprogramar?.id_cita ?? 0);
  const enviando = reservar.isPending || cambiar.isPending;

  // Servicios que se pueden reservar en línea.
  const servicios = useMemo(() => negocio.servicios.filter((s) => s.reservable), [negocio.servicios]);
  const [idServicioElegido, setIdServicio] = useState<number | null>(null);
  const [verServicios, setVerServicios] = useState(false);
  const servicio: ServicioNegocio | undefined = reprogramar
    ? negocio.servicios.find((s) => s.id_servicio === reprogramar.servicio.id_servicio)
    : (servicios.find((s) => s.id_servicio === (idServicioElegido ?? servicioInicial)) ?? servicios[0]);

  // Mascotas vivas; las que el servicio no atiende quedan deshabilitadas con el motivo.
  const vivas = useMemo(() => (mascotas ?? []).filter((m) => !m.fallecido), [mascotas]);
  const motivos = useMemo(
    () =>
      new Map(
        vivas.map((m) => [m.id_mascota, servicio ? motivoNoAtiende(m.especie, servicio.tipo_mascota) : null]),
      ),
    [vivas, servicio],
  );
  const [idMascotaElegida, setIdMascota] = useState<number | null>(null);
  const compatibles = vivas.filter((m) => motivos.get(m.id_mascota) === null);
  const idMascota = reprogramar
    ? reprogramar.mascota.id_mascota
    : (
        [idMascotaElegida, mascotaPreferida]
          .map((id) => compatibles.find((m) => m.id_mascota === id))
          .find(Boolean) ?? compatibles[0]
      )?.id_mascota;

  // Sede: la de la cita al reprogramar; si no, la elegida o la principal.
  const [idSucursalElegida, setIdSucursal] = useState<number | null>(null);
  const sede = reprogramar
    ? (negocio.sucursales.find((s) => s.id_sucursal === reprogramar.sucursal?.id_sucursal) ??
      negocio.sucursales[0])
    : (negocio.sucursales.find((s) => s.id_sucursal === idSucursalElegida) ?? negocio.sucursales[0]);

  const dias = useMemo(() => diasParaAgendar(hoyEnBogota(), sede?.horarios ?? []), [sede]);
  const [fechaElegida, setFecha] = useState<string | null>(null);
  const fecha = fechaElegida ?? dias.find((d) => d.abierto)?.fecha ?? dias[0]!.fecha;

  const consulta =
    servicio && sede ? { id_servicio: servicio.id_servicio, id_sucursal: sede.id_sucursal, fecha } : null;
  const horarios = useHorariosLibres(consulta);
  const libres = horarios.data?.horarios ?? [];

  // La hora elegida vale solo para esta consulta y mientras siga libre.
  const clave = consulta ? `${consulta.id_servicio}-${consulta.id_sucursal}-${consulta.fecha}` : "";
  const [eleccion, setEleccion] = useState<{ clave: string; hora: string } | null>(null);
  const hora =
    eleccion?.clave === clave && libres.some((h) => h.hora_inicio === eleccion.hora) ? eleccion.hora : null;

  const [error, setError] = useState<ErrorReserva | null>(null);

  const elegir =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setError(null);
    };

  const confirmar = () => {
    if (!servicio || !sede || !hora || idMascota === undefined) return;
    setError(null);
    const alFallar = (e: unknown) => {
      const info = errorDeReserva(e);
      setError(info);
      AccessibilityInfo.announceForAccessibility(info.mensaje);
      if (info.recargarHoras) {
        setEleccion(null);
        void horarios.refetch();
      }
    };
    if (reprogramar) {
      cambiar.mutate(
        { fecha, hora_inicio: hora },
        {
          onSuccess: (nueva) =>
            router.replace({
              pathname: "/cita/[id]/confirmada",
              params: { id: nueva.id_cita, reprogramada: "1" },
            }),
          onError: alFallar,
        },
      );
    } else {
      reservar.mutate(
        {
          id_servicio: servicio.id_servicio,
          id_sucursal: sede.id_sucursal,
          fecha,
          hora_inicio: hora,
          id_mascota: idMascota,
        },
        {
          onSuccess: ({ cita }) =>
            router.replace({ pathname: "/cita/[id]/confirmada", params: { id: cita.id_cita } }),
          onError: alFallar,
        },
      );
    }
  };

  const titulo = reprogramar ? "Reprogramar cita" : "Agendar cita";
  const encabezado = (
    <ScreenHeader titulo={titulo} subtitulo={negocio.nombre} volverA={`/negocios/${negocio.id_negocio}`} />
  );

  if (!servicio || !sede) {
    return (
      <View className="flex-1 bg-surface">
        {encabezado}
        <EmptyState
          icono={Stethoscope}
          titulo="Sin reservas en línea"
          descripcion="Este negocio aún no tiene servicios para agendar desde la app. Puedes llamarlo o escribirle desde su perfil."
        />
      </View>
    );
  }

  if (!reprogramar && vivas.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        {encabezado}
        <EmptyState
          icono={PawPrint}
          titulo="Primero registra a tu mascota"
          descripcion="Para agendar una cita necesitas al menos una mascota en tu cuenta."
          accion={{ etiqueta: "Registrar mascota", onPress: () => router.push("/mascotas/nueva") }}
        />
      </View>
    );
  }

  const precio = textoPrecio(servicio);
  const resumen = hora ? fechaYHora(fecha, hora) : "Elige una hora";
  const mesVisible = MESES[Number(fecha.slice(5, 7)) - 1];
  const sinCompatibles = !reprogramar && compatibles.length === 0;

  return (
    <View className="flex-1 bg-surface">
      {encabezado}
      <ScrollView contentContainerClassName="gap-6 px-pantalla pb-8 pt-2">
        {reprogramar ? (
          <View accessible className="gap-1 rounded-card border border-border bg-white p-4">
            <Text variante="apoyo" className="text-muted">
              Cita actual
            </Text>
            <Text className="font-bold">{`${reprogramar.mascota.nombre} · ${reprogramar.servicio.nombre}`}</Text>
            <Text variante="apoyo" className="text-muted">
              {`${fechaYHora(reprogramar.fecha, reprogramar.hora_inicio)} · ${sede.nombre}`}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            <Seccion titulo="¿Para quién?" />
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Mascota"
              className="flex-row flex-wrap gap-3"
            >
              {vivas.map((m) => (
                <OpcionMascota
                  key={m.id_mascota}
                  mascota={m}
                  seleccionada={m.id_mascota === idMascota}
                  motivo={motivos.get(m.id_mascota) ?? null}
                  onPress={() => elegir(setIdMascota)(m.id_mascota)}
                />
              ))}
            </View>
            {sinCompatibles ? (
              <Aviso tono="info">{`${servicio.nombre} no atiende a ninguna de tus mascotas. Elige otro servicio.`}</Aviso>
            ) : null}
            {error?.campoMascota ? <Aviso tono="error">{error.mensaje}</Aviso> : null}
          </View>
        )}

        {!reprogramar && (
          <View className="gap-3">
            <Seccion titulo="Servicio" />
            <View className="flex-row items-center gap-3 rounded-card border border-border bg-white p-4">
              <View className="h-12 w-12 items-center justify-center rounded-control bg-primary-soft">
                <Stethoscope size={24} color={colors["primary-deep"]} accessibilityElementsHidden />
              </View>
              <View accessible className="flex-1 gap-0.5">
                <Text className="font-bold">{servicio.nombre}</Text>
                <Text variante="apoyo" className="text-muted">
                  {`${textoDuracion(servicio.duracion_minutos)} · ${precio}`}
                </Text>
              </View>
              {servicios.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={verServicios ? "Cerrar la lista de servicios" : "Cambiar servicio"}
                  accessibilityState={{ expanded: verServicios }}
                  onPress={() => setVerServicios((v) => !v)}
                  className="min-h-12 justify-center px-2"
                >
                  <Text className="font-bold text-primary-strong">{verServicios ? "Listo" : "Cambiar"}</Text>
                </Pressable>
              )}
            </View>
            {verServicios && (
              <View accessibilityRole="radiogroup" accessibilityLabel="Servicios" className="gap-2">
                {servicios.map((s) => {
                  const activo = s.id_servicio === servicio.id_servicio;
                  return (
                    <Pressable
                      key={s.id_servicio}
                      accessibilityRole="radio"
                      accessibilityLabel={`${s.nombre}. ${textoDuracion(s.duracion_minutos)}. ${textoPrecio(s)}`}
                      accessibilityState={{ checked: activo }}
                      onPress={() => {
                        elegir(setIdServicio)(s.id_servicio);
                        setVerServicios(false);
                      }}
                      className="min-h-12 flex-row items-center justify-between gap-3 rounded-control border px-4 py-3"
                      style={{
                        borderColor: activo ? colors["primary-strong"] : colors.border,
                        backgroundColor: activo ? colors["primary-soft"] : colors.white,
                      }}
                    >
                      <Text className="flex-1 font-semibold">{s.nombre}</Text>
                      <Text variante="apoyo" className="text-muted">
                        {textoPrecio(s)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {!reprogramar && negocio.sucursales.length > 1 && (
          <View className="gap-3">
            <Seccion titulo="Sede" />
            <View className="flex-row flex-wrap gap-2">
              {negocio.sucursales.map((s) => (
                <Chip
                  key={s.id_sucursal}
                  etiqueta={s.nombre}
                  seleccionado={s.id_sucursal === sede.id_sucursal}
                  onPress={() => elegir(setIdSucursal)(s.id_sucursal)}
                />
              ))}
            </View>
            <Text variante="apoyo" className="text-muted">{`${sede.direccion}, ${sede.ciudad}`}</Text>
          </View>
        )}

        <View className="gap-3">
          <Seccion titulo="Fecha" derecha={mesVisible} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            accessibilityRole="radiogroup"
            accessibilityLabel="Día"
          >
            {dias.map((d) => {
              const activo = d.fecha === fecha;
              return (
                <Pressable
                  key={d.fecha}
                  accessibilityRole="radio"
                  accessibilityLabel={`${capitalizar(fechaParaLeer(d.fecha))}${d.abierto ? "" : ". Cerrado"}`}
                  accessibilityState={{ checked: activo, disabled: !d.abierto }}
                  disabled={!d.abierto}
                  onPress={() => elegir(setFecha)(d.fecha)}
                  className="min-h-20 w-16 items-center justify-center rounded-card border py-2"
                  style={{
                    backgroundColor: activo
                      ? colors["primary-strong"]
                      : d.abierto
                        ? colors.white
                        : colors.track,
                    borderColor: activo ? colors["primary-strong"] : colors.border,
                  }}
                >
                  <Text
                    variante="apoyo"
                    style={{
                      fontFamily: fontFamilies.semibold,
                      color: activo ? colors.white : colors.muted,
                    }}
                  >
                    {DIAS_CORTOS[d.diaSemana]}
                  </Text>
                  <Text
                    variante="seccion"
                    style={{ color: activo ? colors.white : d.abierto ? colors.ink : colors.muted }}
                  >
                    {d.dia}
                  </Text>
                  {!d.abierto && (
                    <Text variante="apoyo" className="text-muted" maxFontSizeMultiplier={1.2}>
                      Cerrado
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View className="gap-3">
          <Seccion titulo="Hora" />
          {error && !error.campoMascota ? <Aviso tono="error">{error.mensaje}</Aviso> : null}
          {horarios.isPending ? (
            <SkeletonLista filas={2} etiqueta="Buscando horas libres" />
          ) : horarios.isError ? (
            <ErrorState
              titulo="No pudimos ver las horas"
              error={horarios.error}
              onReintentar={() => horarios.refetch()}
              reintentando={horarios.isFetching}
            />
          ) : libres.length === 0 ? (
            <Aviso tono="info">
              {`${horarios.data?.motivo_sin_horarios ?? "No hay horas libres ese día"}. Prueba con otro día.`}
            </Aviso>
          ) : (
            agruparHorarios(libres).map((g) => (
              <View key={g.titulo} className="gap-2">
                <Text variante="apoyo" className="font-semibold text-muted" accessibilityRole="header">
                  {g.titulo}
                </Text>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={`Horas de la ${g.titulo.toLowerCase()}`}
                  className="flex-row flex-wrap gap-2"
                >
                  {g.horarios.map((h) => {
                    const activa = h.hora_inicio === hora;
                    return (
                      <Pressable
                        key={h.hora_inicio}
                        accessibilityRole="radio"
                        accessibilityLabel={formatearHora(h.hora_inicio)}
                        accessibilityState={{ checked: activa }}
                        onPress={() => elegir(setEleccion)({ clave, hora: h.hora_inicio })}
                        className="min-h-12 items-center justify-center rounded-control border"
                        style={{
                          width: "31%",
                          backgroundColor: activa ? colors["primary-strong"] : colors.white,
                          borderColor: activa ? colors["primary-strong"] : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fontFamilies.bold,
                            color: activa ? colors.white : colors.ink,
                          }}
                        >
                          {horaCorta(h.hora_inicio)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View
        className="gap-3 border-t border-border bg-white px-pantalla pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            hora
              ? `${capitalizar(fechaParaLeer(fecha))}, ${conPunto(formatearHora(hora))} ${precio}`
              : "Elige una hora"
          }
          className="flex-row items-center justify-between gap-3"
        >
          <Text className="flex-1 font-bold">{resumen}</Text>
          <Text variante="seccion" className="text-primary-deep">
            {precio}
          </Text>
        </View>
        <Button
          titulo={reprogramar ? "Confirmar cambio" : "Confirmar cita"}
          disabled={!hora || idMascota === undefined}
          cargando={enviando}
          onPress={confirmar}
        />
      </View>
    </View>
  );
}
