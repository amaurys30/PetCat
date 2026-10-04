import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { ActualizarNegocioBody, NegocioGestion } from "@/api/negocios";
import { Avatar } from "@/components/common/Avatar";
import { AvisoCambiosSinGuardar } from "@/components/common/AvisoCambiosSinGuardar";
import { SubidorImagen } from "@/components/common/SubidorImagen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { aviso } from "@/components/ui/toaster";
import { useActualizarNegocio, useImagenNegocio } from "@/features/negocios/hooks/useGestion";
import { TIPOS_NEGOCIO } from "@/features/negocios/textos";
import { aplicarErroresApi, soloCambios } from "@/lib/forms";
import { useConfiguracion } from "../contexto";
import {
  CAMPOS_PERFIL_NEGOCIO,
  conEsquema,
  perfilNegocioSchema,
  type PerfilNegocioValores,
} from "../schemas";

/** "60" -> "1 h", "90" -> "1 h 30 min", "30" -> "30 min". */
const duracion = (minutos: number) => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return [h > 0 ? `${h} h` : "", m > 0 ? `${m} min` : ""].filter(Boolean).join(" ");
};

/** E1 · Perfil del negocio: imagen, datos, confirmación automática y la vista de la app. */
export function PerfilNegocioPage() {
  const { negocio, puedeEditar } = useConfiguracion();
  const [nombreEnVivo, setNombreEnVivo] = useState(negocio.nombre);

  return (
    <div className="grid grid-cols-[1fr_380px] items-start gap-5">
      <div className="flex flex-col gap-5">
        <ImagenNegocio negocio={negocio} puedeEditar={puedeEditar} />
        <DatosNegocio negocio={negocio} puedeEditar={puedeEditar} onNombre={setNombreEnVivo} />
      </div>
      <div className="flex flex-col gap-5">
        <ConfirmacionCitas negocio={negocio} puedeEditar={puedeEditar} />
        <VistaApp negocio={negocio} nombre={nombreEnVivo} />
      </div>
    </div>
  );
}

function ImagenNegocio({ negocio, puedeEditar }: { negocio: NegocioGestion; puedeEditar: boolean }) {
  const banner = useImagenNegocio(negocio.id_negocio, "banner");
  const logo = useImagenNegocio(negocio.id_negocio, "logo");
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-card font-semibold text-ink">Imagen del negocio</h2>
      <SubidorImagen
        etiqueta="Banner"
        ayuda="1600 px de ancho recomendado · JPG, PNG o WebP · hasta 8 MB"
        maxMb={8}
        forma="banner"
        nombre={negocio.nombre}
        urlActual={negocio.banner_url}
        disabled={!puedeEditar}
        onSubir={(archivo, onProgreso) => banner.subir.mutateAsync({ archivo, onProgreso })}
        onQuitar={() => banner.quitar.mutateAsync()}
      />
      <SubidorImagen
        etiqueta="Logo"
        ayuda="PNG con transparencia recomendado · hasta 5 MB"
        maxMb={5}
        forma="circulo"
        nombre={negocio.nombre}
        urlActual={negocio.logo_url}
        disabled={!puedeEditar}
        onSubir={(archivo, onProgreso) => logo.subir.mutateAsync({ archivo, onProgreso })}
        onQuitar={() => logo.quitar.mutateAsync()}
      />
    </Card>
  );
}

function DatosNegocio({
  negocio,
  puedeEditar,
  onNombre,
}: {
  negocio: NegocioGestion;
  puedeEditar: boolean;
  onNombre: (nombre: string) => void;
}) {
  const actualizar = useActualizarNegocio(negocio.id_negocio);
  const iniciales: PerfilNegocioValores = {
    nombre: negocio.nombre,
    tipo: negocio.tipo,
    descripcion: negocio.descripcion ?? "",
    telefono: negocio.telefono ?? "",
    whatsapp: negocio.whatsapp ?? "",
    email: negocio.email ?? "",
    nit: negocio.nit ?? "",
    razon_social: negocio.razon_social ?? "",
    sitio_web: negocio.sitio_web ?? "",
  };
  const form = useForm<PerfilNegocioValores>({
    resolver: zodResolver(perfilNegocioSchema),
    defaultValues: iniciales,
  });
  const { errors, isDirty } = form.formState;
  const nombre = useWatch({ control: form.control, name: "nombre" });
  const sucio = useRef(false);
  const haySinGuardar = useCallback(() => sucio.current, []);

  useEffect(() => {
    sucio.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    onNombre(nombre);
  }, [nombre, onNombre]);

  const onSubmit = form.handleSubmit((valores) => {
    const normalizados = { ...valores, sitio_web: valores.sitio_web && conEsquema(valores.sitio_web) };
    // El esquema no deja vacíos el nombre ni el tipo: nunca van en null.
    const cambios = soloCambios(normalizados, iniciales) as ActualizarNegocioBody;
    if (Object.keys(cambios).length === 0) return;
    actualizar.mutate(cambios, {
      onSuccess: () => {
        form.reset(normalizados);
        aviso.exito("Datos del negocio guardados");
      },
      onError: (e) => {
        if (!aplicarErroresApi(form.setError, e, CAMPOS_PERFIL_NEGOCIO)) aviso.error(e.message);
      },
    });
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-card font-semibold text-ink">Datos del negocio</h2>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={!puedeEditar || actualizar.isPending} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *" error={errors.nombre?.message}>
              <Input {...form.register("nombre")} />
            </Field>
            <Field label="Tipo *" error={errors.tipo?.message}>
              <NativeSelect {...form.register("tipo")}>
                {Object.entries(TIPOS_NEGOCIO).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Descripción" error={errors.descripcion?.message}>
            <Input {...form.register("descripcion")} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Teléfono" error={errors.telefono?.message}>
              <Input type="tel" {...form.register("telefono")} />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp?.message}>
              <Input type="tel" {...form.register("whatsapp")} />
            </Field>
            <Field label="Correo" error={errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="NIT" error={errors.nit?.message}>
              <Input {...form.register("nit")} />
            </Field>
            <Field label="Razón social" error={errors.razon_social?.message}>
              <Input {...form.register("razon_social")} />
            </Field>
            <Field label="Sitio web" error={errors.sitio_web?.message}>
              <Input placeholder="patitas.co" {...form.register("sitio_web")} />
            </Field>
          </div>
          {puedeEditar && (
            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty} cargando={actualizar.isPending}>
                Guardar cambios
              </Button>
            </div>
          )}
        </fieldset>
      </form>
      <AvisoCambiosSinGuardar haySinGuardar={haySinGuardar} />
    </Card>
  );
}

function ConfirmacionCitas({ negocio, puedeEditar }: { negocio: NegocioGestion; puedeEditar: boolean }) {
  const actualizar = useActualizarNegocio(negocio.id_negocio);
  const reglas = negocio.reglas_confirmacion;
  // Se aplica al instante: el interruptor cambia ya y vuelve atrás si la API falla.
  const [automatica, setAutomatica] = useState(negocio.confirmacion_automatica);
  const { dias, total } = reglas.citas_perdidas;

  const cambiar = (valor: boolean) => {
    setAutomatica(valor);
    actualizar.mutate(
      { confirmacion_automatica: valor },
      {
        onSuccess: () =>
          aviso.exito(valor ? "Confirmación automática activada" : "Confirmación automática desactivada"),
        onError: (e) => {
          setAutomatica(!valor);
          aviso.error(e.message);
        },
      },
    );
  };

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-card font-semibold text-ink">Confirmación de citas</h2>
      <div className="flex items-start gap-3">
        <Switch
          id="confirmacion-automatica"
          checked={automatica}
          disabled={!puedeEditar || actualizar.isPending}
          onCheckedChange={cambiar}
        />
        <div>
          <Label htmlFor="confirmacion-automatica" className="text-body font-semibold text-ink">
            Confirmar automáticamente las reservas de la app
          </Label>
          <p className="text-label text-muted">
            {automatica
              ? "Las reservas de la app quedan confirmadas al instante."
              : `Si está apagado, tienes hasta ${reglas.plazo_confirmacion_h} h (o hasta ${duracion(reglas.confirmacion_antes_inicio_min)} antes de la cita) para confirmar cada reserva; si no, se cancela sola.`}
          </p>
        </div>
      </div>
      {total > 0 && (
        <Alert tono="advertencia" className="mt-4">
          En los últimos {dias} días {total === 1 ? "perdiste 1 cita" : `perdiste ${total} citas`} por no
          confirmarlas a tiempo.
        </Alert>
      )}
    </Card>
  );
}

/** "Así te ven en la app": sigue en vivo el nombre que se escribe; sin la distancia. */
function VistaApp({ negocio, nombre }: { negocio: NegocioGestion; nombre: string }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-card font-semibold text-ink">Así te ven en la app</h2>
      <div className="overflow-hidden rounded-card border">
        <div className="h-24 bg-primary-soft">
          {negocio.banner_url && <img src={negocio.banner_url} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex items-start gap-3 p-3.5">
          <Avatar nombre={nombre || negocio.nombre} fotoUrl={negocio.logo_miniatura_url} tamano="lg" />
          <div className="min-w-0">
            <p className="truncate text-card font-semibold text-ink">{nombre || negocio.nombre}</p>
            <p className="flex items-center gap-1 text-label text-muted">
              {negocio.total_resenas > 0 ? (
                <>
                  <Star className="size-3 fill-warning text-warning" aria-hidden />
                  {negocio.calificacion_promedio.toFixed(1)} · {negocio.total_resenas}{" "}
                  {negocio.total_resenas === 1 ? "reseña" : "reseñas"}
                </>
              ) : (
                "Sin reseñas todavía"
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {negocio.verificado && (
                <Badge tono="info">
                  <BadgeCheck className="size-3" aria-hidden /> Verificado
                </Badge>
              )}
              {negocio.confirmacion_automatica && <Badge tono="primary">Confirmación inmediata</Badge>}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-label text-muted">
        &quot;Confirmación inmediata&quot; aparece solo si activas la confirmación automática.
      </p>
    </Card>
  );
}
