/**
 * Botones y piezas de las páginas públicas. El texto blanco va sobre primary-dark (6:1).
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-card font-semibold transition-colors [&_svg]:size-5 [&_svg]:shrink-0";

export const botonPrimario = `${BASE} h-12 bg-primary-dark px-6 text-[15px] text-white hover:bg-primary-deep`;

export const botonSecundario = `${BASE} h-12 border border-primary-deep/25 bg-white px-6 text-[15px] text-primary-deep hover:bg-primary-soft`;

/** Sobre el degradado oscuro de marca. */
export const botonClaro = `${BASE} h-12 bg-white px-6 text-[15px] text-primary-deep hover:bg-primary-soft`;

export const botonBorde = `${BASE} h-12 border border-white/70 px-6 text-[15px] text-white hover:bg-white/10`;

export const contenedor = "mx-auto w-full max-w-[1160px] px-4 sm:px-6 lg:px-8";

export const etiquetaSeccion =
  "inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[13px] font-semibold text-primary-deep";

export const tituloSeccion = "text-[28px] leading-[34px] font-bold tracking-tight text-ink sm:text-[36px] sm:leading-[44px]";

export const textoSeccion = "text-[16px] leading-[26px] text-muted sm:text-[17px] sm:leading-[28px]";
