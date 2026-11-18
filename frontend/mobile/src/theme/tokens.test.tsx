import { Text, View } from "react-native";
import { render, screen } from "nativewind/test";

import { Text as TextoPetCat } from "@/components/ui/Text";

import { colors, fontFamilies } from "./tokens";

// Compila las clases con el mismo tema de tailwind.config.js, como Metro en la app.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- configuración CommonJS
const { theme } = require("../../tailwind.config");

describe("tokens en NativeWind", () => {
  it("colores, radios y escala tipográfica", async () => {
    await render(
      <View testID="caja" className="rounded-control bg-primary-strong">
        <Text testID="texto" className="font-extrabold text-titulo text-ink">
          PetCat
        </Text>
      </View>,
      { config: { theme } },
    );
    expect(screen.getByTestId("caja")).toHaveStyle({
      backgroundColor: colors["primary-strong"].toLowerCase(),
      borderRadius: 16,
    });
    expect(screen.getByTestId("texto")).toHaveStyle({
      color: colors.ink.toLowerCase(),
      fontFamily: fontFamilies.extrabold,
      fontSize: 28,
      lineHeight: 34,
    });
  });

  it("font-bold es la familia del peso 700, sin fontWeight encima", async () => {
    await render(<Text testID="t" className="font-bold" />, { config: { theme } });
    const estilo = screen.getByTestId("t").props.style;
    expect(estilo).toMatchObject({ fontFamily: fontFamilies.bold });
    expect(estilo.fontWeight).toBeUndefined();
  });

  // Con dos font-* en el mismo elemento no gana la última escrita, sino el orden del CSS
  // generado. Por eso Text quita la familia de su variante cuando className trae un peso.
  it("Text con variante cuerpo y className font-bold queda en negrita", async () => {
    await render(
      <TextoPetCat testID="t" variante="cuerpo" className="font-bold">
        Guardar
      </TextoPetCat>,
      { config: { theme } },
    );
    // (nativewind/test solo compila las clases escritas en este archivo; por eso no se mira el tamaño)
    expect(screen.getByTestId("t").props.style).toMatchObject({ fontFamily: fontFamilies.bold });
  });
});
