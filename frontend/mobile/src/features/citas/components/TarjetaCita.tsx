import { useRouter } from "expo-router";
import { Navigation } from "lucide-react-native";
import { Pressable, View } from "react-native";

import type { Cita, EstadoCita } from "@/api/types";
import { Button, Text } from "@/components/ui";
import { parsearFechaApi } from "@/lib/fechas";
import { formatearHora } from "@/lib/formatos";
import { colors } from "@/theme/tokens";

import { accionComoLlegar } from "../acciones";
import { etiquetaCita, puedeCancelar, puedeReprogramar, textoEstado } from "../logica";

const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEPT", "OCT", "NOV", "DIC"];

// Estado en texto, con su color (AA sobre su fondo): nunca solo el color.
const TONO: Record<EstadoCita, { fondo: string; texto: string }> = {
  pendiente: { fondo: colors["sun-soft"], texto: colors["sun-ink"] },
  confirmada: { fondo: colors["primary-soft"], texto: colors["primary-deep"] },
  en_curso: { fondo: colors["info-soft"], texto: colors["info-ink"] },
  completada: { fondo: colors.track, texto: colors.ink },
  cancelada: { fondo: colors["danger-soft"], texto: colors["danger-ink"] },
  no_asistio: { fondo: colors["danger-soft"], texto: colors["danger-ink"] },
  reprogramada: { fondo: colors.track, texto: colors.muted },
};

export function ChipEstado({ estado }: { estado: EstadoCita }) {
  const tono = TONO[estado] ?? TONO.completada;
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1"
      style={{ backgroundColor: tono.fondo }}
    >
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: tono.texto }} />
      <Text variante="apoyo" className="font-bold" style={{ color: tono.texto }}>
        {textoEstado(estado)}
      </Text>
    </View>
  );
}

/** Bloque de la fecha ("VIE 15 NOV"). */
export function BloqueFecha({ fecha, activa }: { fecha: string; activa: boolean }) {
  const f = parsearFechaApi(fecha);
  return (
    <View
      className="w-16 items-center rounded-control py-2"
      style={{ backgroundColor: activa ? colors["coral-soft"] : colors.track }}
    >
      <Text
        variante="apoyo"
        className="font-bold"
        style={{ color: activa ? colors["coral-dark"] : colors.muted }}
      >
        {DIAS[f.diaSemana]}
      </Text>
      <Text variante="titulo">{f.dia}</Text>
      <Text variante="apoyo" className="text-muted">
        {MESES[f.mes - 1]}
      </Text>
    </View>
  );
}

type Props = {
  cita: Cita;
  onCancelar: (cita: Cita) => void;
  cancelando: boolean;
};

/**
 * Cita en Mis citas. Para el lector: los datos son un botón que abre el detalle (todo en su
 * etiqueta) y las acciones van aparte, cada una con lo que hace.
 */
export function TarjetaCita({ cita, onCancelar, cancelando }: Props) {
  const router = useRouter();
  const llegar = accionComoLlegar(cita);
  const cancelable = puedeCancelar(cita);
  const reprogramable = puedeReprogramar(cita);

  return (
    <View className="gap-4 rounded-card border border-border bg-white p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={etiquetaCita(cita)}
        accessibilityHint="Abre el detalle de la cita"
        onPress={() => router.push({ pathname: "/cita/[id]", params: { id: cita.id_cita } })}
        className="flex-row gap-4 active:opacity-80"
      >
        <BloqueFecha fecha={cita.fecha} activa={cancelable} />
        <View className="flex-1 gap-1.5">
          <Text variante="cuerpoMedio" className="font-bold">
            {cita.servicio.nombre}
          </Text>
          <Text variante="apoyo" className="text-muted">
            {`${cita.negocio.nombre} · ${formatearHora(cita.hora_inicio)}`}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipEstado estado={cita.estado} />
            <View className="self-start rounded-full bg-track px-3 py-1">
              <Text variante="apoyo" className="font-semibold">
                {cita.mascota.nombre}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      {cancelable && (
        <View className="flex-row flex-wrap gap-2">
          {llegar && (
            <Button
              titulo="Cómo llegar"
              variante="suave"
              icono={Navigation}
              accessibilityLabel={`Cómo llegar a ${cita.negocio.nombre}`}
              onPress={llegar}
              className="flex-grow"
            />
          )}
          {reprogramable && (
            <Button
              titulo="Reprogramar"
              variante="secundario"
              accessibilityLabel={`Reprogramar ${cita.servicio.nombre} de ${cita.mascota.nombre}`}
              onPress={() =>
                router.push({ pathname: "/cita/[id]/reprogramar", params: { id: cita.id_cita } })
              }
              className="flex-grow"
            />
          )}
          <Button
            titulo="Cancelar"
            variante="secundario"
            accessibilityLabel={`Cancelar ${cita.servicio.nombre} de ${cita.mascota.nombre}`}
            cargando={cancelando}
            onPress={() => onCancelar(cita)}
            className="flex-grow"
          />
        </View>
      )}
    </View>
  );
}
