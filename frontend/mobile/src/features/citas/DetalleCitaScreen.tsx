import { useLocalSearchParams, useRouter } from "expo-router";
import { Navigation, Phone } from "lucide-react-native";
import { Linking, ScrollView, View } from "react-native";

import { Aviso, Button, ErrorState, ScreenHeader, SkeletonLista, Text } from "@/components/ui";
import { conPunto } from "@/features/explorar/logica";
import { formatearDinero, formatearFecha, formatearHora } from "@/lib/formatos";

import { accionComoLlegar, useCancelarConConfirmacion } from "./acciones";
import { BloqueFecha, ChipEstado } from "./components/TarjetaCita";
import { useCita, useRefrescarAlVolver } from "./hooks";
import { fechaYHora, HORAS_AVISO, puedeCancelar, puedeReprogramar } from "./logica";

function Fila({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View accessible accessibilityLabel={`${rotulo}: ${valor}`} className="gap-0.5">
      <Text variante="apoyo" className="text-muted">
        {rotulo}
      </Text>
      <Text>{valor}</Text>
    </View>
  );
}

/** Detalle de una cita del dueño (desde Mis citas y desde la próxima cita de Inicio). */
export function DetalleCitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cita = useCita(Number(id));
  const { pedir, cancelando } = useCancelarConConfirmacion();
  useRefrescarAlVolver(cita.refetch);

  const c = cita.data;
  if (!c) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader titulo="Cita" volverA="/citas" />
        {cita.isPending ? (
          <SkeletonLista filas={3} etiqueta="Cargando la cita" />
        ) : (
          <ErrorState error={cita.error} onReintentar={() => cita.refetch()} reintentando={cita.isFetching} />
        )}
      </View>
    );
  }

  const cancelable = puedeCancelar(c);
  const reprogramable = puedeReprogramar(c);
  const llegar = accionComoLlegar(c);
  const s = c.sucursal;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo={c.servicio.nombre} subtitulo={c.negocio.nombre} volverA="/citas" />
      <ScrollView contentContainerClassName="gap-4 px-pantalla pb-8">
        <View className="flex-row items-center gap-4 rounded-card border border-border bg-white p-4">
          <BloqueFecha fecha={c.fecha} activa={cancelable} />
          <View accessible className="flex-1 gap-1.5">
            <Text variante="cuerpoMedio" className="font-bold">
              {fechaYHora(c.fecha, c.hora_inicio)}
            </Text>
            <Text variante="apoyo" className="text-muted">{`Hasta las ${formatearHora(c.hora_fin)}`}</Text>
            <ChipEstado estado={c.estado} />
          </View>
        </View>

        {c.estado === "pendiente" && c.confirmar_antes_de && (
          <Aviso tono="info">
            {`${c.negocio.nombre} debe confirmarla antes del ${formatearFecha(c.confirmar_antes_de)}, ${conPunto(formatearHora(c.confirmar_antes_de))} Si no lo hace, se cancela sola.`}
          </Aviso>
        )}
        {c.estado === "cancelada" && c.cancelacion && (
          <Aviso tono="info">
            {[
              c.cancelacion.por === "dueno"
                ? "La cancelaste tú."
                : c.cancelacion.por === "sistema"
                  ? "Se canceló porque el negocio no la confirmó a tiempo."
                  : "La canceló el negocio.",
              c.cancelacion.motivo && c.cancelacion.por === "negocio"
                ? `Motivo: ${c.cancelacion.motivo}.`
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </Aviso>
        )}

        <View className="gap-4 rounded-card border border-border bg-white p-4">
          <Fila rotulo="Mascota" valor={c.mascota.nombre} />
          <Fila rotulo="Servicio" valor={c.servicio.nombre} />
          {s && <Fila rotulo="Dónde" valor={`${c.negocio.nombre}, ${s.nombre}. ${s.direccion}`} />}
          {c.empleado && <Fila rotulo="Te atiende" valor={`${c.empleado.nombre} ${c.empleado.apellido}`} />}
          <Fila
            rotulo={c.precio_final !== null ? "Valor" : "Valor estimado"}
            valor={formatearDinero(c.precio_final ?? c.precio_estimado)}
          />
          {c.notas_cliente ? <Fila rotulo="Tus notas" valor={c.notas_cliente} /> : null}
        </View>

        {(llegar || s?.telefono) && (
          <View className="flex-row flex-wrap gap-2">
            {llegar && (
              <Button
                titulo="Cómo llegar"
                variante="suave"
                icono={Navigation}
                accessibilityLabel={`Cómo llegar a ${c.negocio.nombre}`}
                onPress={llegar}
                className="flex-grow"
              />
            )}
            {s?.telefono && (
              <Button
                titulo="Llamar"
                variante="suave"
                icono={Phone}
                accessibilityLabel={`Llamar a ${c.negocio.nombre}`}
                onPress={() => void Linking.openURL(`tel:${s.telefono!.replace(/\D/g, "")}`)}
                className="flex-grow"
              />
            )}
          </View>
        )}

        {cancelable && (
          <View className="gap-3">
            {reprogramable ? (
              <Button
                titulo="Reprogramar"
                variante="secundario"
                onPress={() => router.push({ pathname: "/cita/[id]/reprogramar", params: { id: c.id_cita } })}
              />
            ) : (
              <Text variante="apoyo" className="text-muted">
                {`Ya no se puede reprogramar: faltan menos de ${HORAS_AVISO} horas.`}
              </Text>
            )}
            <Button
              titulo="Cancelar cita"
              variante="peligro"
              cargando={cancelando === c.id_cita}
              onPress={() => pedir(c)}
            />
          </View>
        )}
        {c.id_cita_origen !== null && (
          <Text variante="apoyo" className="text-muted">
            Esta cita reemplaza a otra que se reprogramó.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
