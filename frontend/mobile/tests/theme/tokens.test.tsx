import { Text, View } from "react-native";
import { render, screen } from "nativewind/test";

import { colors, fontFamily } from "@/theme/tokens";

// Compila las clases con el mismo tema de tailwind.config.js, como Metro en la app:
// confirma que los tokens llegan a NativeWind y que className se vuelve estilo nativo.
const { theme } = require("../../tailwind.config");

describe("tokens en NativeWind", () => {
  it("traduce las clases de color, radio y tipografía de la guía", async () => {
    await render(
      <View testID="caja" className="rounded-control bg-primary">
        <Text testID="texto" className="font-negrita text-cuerpo text-ink">
          PetCat
        </Text>
      </View>,
      { config: { theme } },
    );

    expect(screen.getByTestId("caja")).toHaveStyle({
      backgroundColor: colors.primary.toLowerCase(),
      borderRadius: 16,
    });
    expect(screen.getByTestId("texto")).toHaveStyle({
      color: colors.ink.toLowerCase(),
      fontFamily: fontFamily.negrita[0],
      fontSize: 15,
      lineHeight: 22,
    });
  });
});
