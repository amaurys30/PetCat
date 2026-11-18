import * as SecureStore from "expo-secure-store";

// El refresh token vive solo en SecureStore (Keychain / Keystore). El access token, en memoria.
const CLAVE = "petcat.refresh_token";

export const refreshStorage = {
  leer: () => SecureStore.getItemAsync(CLAVE),
  guardar: (token: string) => SecureStore.setItemAsync(CLAVE, token),
  borrar: () => SecureStore.deleteItemAsync(CLAVE),
};
