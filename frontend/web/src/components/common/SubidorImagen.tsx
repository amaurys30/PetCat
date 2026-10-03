import { ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  /** "Logo", "Banner", "Foto": se usa en los botones y mensajes. */
  etiqueta: string;
  /** Artículo de la etiqueta: "el logo", "la foto". */
  articulo?: "el" | "la";
  ayuda: string;
  maxMb: number;
  urlActual: string | null;
  forma: "banner" | "circulo";
  /** Para las iniciales cuando no hay imagen (forma círculo). */
  nombre: string;
  disabled?: boolean;
  onSubir: (archivo: File, onProgreso: (porcentaje: number) => void) => Promise<unknown>;
  onQuitar: () => Promise<unknown>;
}

/**
 * Sube o quita una imagen (logo, banner, foto de perfil). Valida tipo y tamaño en el
 * navegador antes de enviar (la API valida igual), muestra la vista previa y el progreso.
 */
export function SubidorImagen({
  etiqueta,
  articulo = "el",
  ayuda,
  maxMb,
  urlActual,
  forma,
  nombre,
  disabled,
  onSubir,
  onQuitar,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const minuscula = etiqueta.toLowerCase();

  // La vista previa local se libera al terminar o al desmontar.
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    if (!TIPOS.includes(archivo.type)) return setError("Usa una imagen JPG, PNG o WebP.");
    if (archivo.size > maxMb * 1024 * 1024) return setError(`La imagen pesa más de ${maxMb} MB.`);
    setPrevia(URL.createObjectURL(archivo));
    setProgreso(0);
    try {
      await onSubir(archivo, setProgreso);
    } catch (e) {
      const apiError = toApiError(e);
      setError(Object.values(apiError.errors)[0] ?? apiError.message);
    } finally {
      setPrevia(null);
      setProgreso(null);
    }
  };

  const quitar = async () => {
    setQuitando(true);
    setError(null);
    try {
      await onQuitar();
      setConfirmarQuitar(false);
    } catch (e) {
      setError(toApiError(e).message);
      setConfirmarQuitar(false);
    } finally {
      setQuitando(false);
    }
  };

  const imagen = previa ?? urlActual;
  const subiendo = progreso !== null;
  const botones = !disabled && (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={subiendo}>
        {urlActual ? `Cambiar ${minuscula}` : `Subir ${minuscula}`}
      </Button>
      {urlActual && (
        <Button variant="secondary" size="sm" onClick={() => setConfirmarQuitar(true)} disabled={subiendo}>
          Quitar
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={TIPOS.join(",")}
        className="hidden"
        aria-label={`Archivo de ${minuscula}`}
        onChange={(e) => {
          void elegir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {forma === "banner" ? (
        <div>
          <div
            className={cn(
              "relative flex h-40 items-center justify-center overflow-hidden rounded-card bg-primary-soft",
              subiendo && "opacity-70",
            )}
          >
            {imagen ? (
              <img src={imagen} alt={etiqueta} className="size-full object-cover" />
            ) : (
              <div className="text-center text-primary-dark">
                <p className="flex items-center justify-center gap-1.5 text-body font-semibold">
                  <ImageIcon className="size-4" aria-hidden /> {etiqueta}
                </p>
                <p className="text-label">{ayuda}</p>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            {imagen ? <p className="text-label text-muted">{ayuda}</p> : <span />}
            {botones}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Avatar nombre={nombre} fotoUrl={imagen} tamano="xl" className={cn(subiendo && "opacity-70")} />
          <div>
            <p className="text-body font-semibold text-ink">{etiqueta}</p>
            <p className="mb-2 text-label text-muted">{ayuda}</p>
            {botones}
          </div>
        </div>
      )}
      {subiendo && (
        <div
          role="progressbar"
          aria-label={`Subiendo ${minuscula}`}
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-track"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progreso}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-label text-danger">
          {error}
        </p>
      )}
      <ConfirmDialog
        abierto={confirmarQuitar}
        onAbiertoChange={setConfirmarQuitar}
        titulo={`¿Quitar ${articulo} ${minuscula}?`}
        confirmar="Quitar"
        peligro
        cargando={quitando}
        onConfirmar={() => void quitar()}
      />
    </div>
  );
}
