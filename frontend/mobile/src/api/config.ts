import Constants from "expo-constants";
import { Platform } from "react-native";

import { resolverApiUrl } from "./origen";

export const API_URL = resolverApiUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  plataforma: Platform.OS,
});
