import type { ExpoConfig } from "expo/config";

// Proyecto de EAS vinculado con `npx eas-cli@latest init`. El projectId lo necesita el token de
// Expo Push (M6); owner y slug tienen que coincidir con la cuenta y el proyecto en expo.dev.
const config: ExpoConfig = {
  name: "PetCat",
  owner: "petcat", // nombre de la cuenta en expo.dev, en minúsculas (EAS lo compara exacto)
  slug: "petcat",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "petcat",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "co.petcat.app",
    supportsTablet: false,
  },
  android: {
    package: "co.petcat.app",
    adaptiveIcon: {
      backgroundColor: "#E3F6F3",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-secure-store",
    [
      "expo-splash-screen",
      { backgroundColor: "#0F7D76", image: "./assets/images/splash-icon.png", imageWidth: 76 },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    eas: { projectId: "416e9696-62c4-451b-a495-2b29f7a627e3" },
  },
};

export default config;
