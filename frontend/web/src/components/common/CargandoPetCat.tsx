import { Logo } from "./Logo";

/** Pantalla completa de carga: sesión que se renueva o código del panel que se descarga. */
export function CargandoPetCat() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Cargando PetCat">
      <Logo className="animate-pulse" />
    </div>
  );
}
