export declare const colors: {
  readonly marca: string;
  readonly primary: string;
  readonly "primary-deep": string;
  readonly "primary-soft": string;
  readonly ink: string;
  readonly muted: string;
  readonly coral: string;
  readonly sol: string;
  readonly lavanda: string;
  readonly fondo: string;
  readonly white: string;
  readonly border: string;
  readonly danger: string;
  readonly "danger-soft": string;
  readonly "warning-ink": string;
  readonly "warning-soft": string;
  readonly info: string;
  readonly "info-soft": string;
};
export declare const fontFamily: Record<
  "sans" | "medio" | "seminegrita" | "negrita" | "extranegrita",
  string[]
>;
export declare const fontSize: Record<string, [string, { lineHeight: string }]>;
export declare const borderRadius: Record<"control" | "tarjeta" | "hoja", string>;
export declare const degradadoMarca: {
  colors: readonly [string, string, string];
  locations: readonly [number, number, number];
};
export declare const tactil: { minimo: number; separacion: number };
