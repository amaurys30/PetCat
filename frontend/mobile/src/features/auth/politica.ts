import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { getPoliticaDatos } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";

export function usePoliticaDatos() {
  return useQuery({ queryKey: queryKeys.politicaDatos(), queryFn: getPoliticaDatos, staleTime: 60 * 60_000 });
}

/**
 * "Ver política": con la URL configurada abre el texto completo en el navegador de la app;
 * mientras `politica_datos_url` esté vacía (o no se pueda consultar), el resumen provisional.
 */
export function useAbrirPolitica() {
  const router = useRouter();
  const politica = usePoliticaDatos();
  return async () => {
    const url = politica.data?.url;
    if (url) await WebBrowser.openBrowserAsync(url);
    else router.push("/politica");
  };
}
