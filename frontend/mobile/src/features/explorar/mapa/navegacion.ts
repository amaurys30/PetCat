/**
 * Qué puede cargar el WebView del mapa como página (onShouldStartLoadWithRequest): solo la propia
 * página (about:blank o data:, según la plataforma). Cualquier otro sitio (por ejemplo, el enlace
 * de la atribución) no se abre dentro del mapa: se devuelve para abrirlo fuera, en el navegador.
 *
 * Las teselas no pasan por aquí: son imágenes, no navegación. Las limita la CSP de la página
 * (img-src con el origen de EXPO_PUBLIC_MAP_TILES_URL, ver html.ts).
 */
export type DecisionNavegacion = { cargar: boolean; abrirFuera: string | null };

export function decidirNavegacion(url: string): DecisionNavegacion {
  if (url === "about:blank" || url.startsWith("about:blank#") || url.startsWith("data:")) {
    return { cargar: true, abrirFuera: null };
  }
  return { cargar: false, abrirFuera: /^https?:\/\//i.test(url) ? url : null };
}
