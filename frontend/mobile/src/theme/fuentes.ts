import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { fontFamilies } from "./tokens";

// Mapa para useFonts: el nombre de cada familia es el de tokens.fontFamilies.
export const fuentes = {
  [fontFamilies.regular]: PlusJakartaSans_400Regular,
  [fontFamilies.medium]: PlusJakartaSans_500Medium,
  [fontFamilies.semibold]: PlusJakartaSans_600SemiBold,
  [fontFamilies.bold]: PlusJakartaSans_700Bold,
  [fontFamilies.extrabold]: PlusJakartaSans_800ExtraBold,
};
