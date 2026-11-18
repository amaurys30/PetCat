// Contraste WCAG 2.x entre dos colores hex (#RRGGBB).

function luminancia(hex: string): number {
  const limpio = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) throw new Error(`Color inválido: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(limpio.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razonContraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** AA: 4,5:1 para texto normal; 3:1 para texto grande (≥ 18 px negrita o ≥ 24 px) y bordes de controles. */
export function cumpleAA(texto: string, fondo: string, { grande = false } = {}): boolean {
  return razonContraste(texto, fondo) >= (grande ? 3 : 4.5);
}
