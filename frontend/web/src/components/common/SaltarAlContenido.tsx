/**
 * Primer elemento enfocable de cada pantalla: lleva el foco al contenido principal sin pasar
 * por el menú. Solo se ve al recibir el foco con el teclado. El destino es un `main` con
 * id="contenido" y tabIndex={-1}.
 */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="sr-only rounded-control bg-white px-4 py-2 text-body font-semibold text-primary-dark shadow-modal focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
    >
      Saltar al contenido
    </a>
  );
}
