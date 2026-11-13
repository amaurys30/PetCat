import { createBrowserRouter, type RouteObject } from "react-router";
import { LandingPage } from "@/features/publico/pages/LandingPage";
import { ErrorDeRuta, PaginaNoEncontrada } from "./pages/PaginasGenerales";

export const ID_RAIZ = "raiz";

const paraNegocios = async () => ({
  Component: (await import("@/features/publico/pages/ParaNegociosPage")).ParaNegociosPage,
});

/**
 * Rutas de la app: las páginas públicas (landing y para negocios) y, debajo de la raíz, las del
 * panel (`rutasPanel`). En el navegador el panel no viene aquí: se agrega al navegar a una de
 * sus rutas (`patchRoutesOnNavigation`). Las pruebas pasan `rutasPanel` para tenerlas desde el
 * inicio.
 */
export function crearRutas(panel: RouteObject[] = []): RouteObject[] {
  return [
    {
      id: ID_RAIZ,
      errorElement: <ErrorDeRuta />,
      children: [
        { index: true, element: <LandingPage /> },
        { path: "para-negocios", lazy: paraNegocios },
        ...panel,
        { path: "*", element: <PaginaNoEncontrada /> },
      ],
    },
  ];
}

let rutasPanel: Promise<RouteObject[]> | null = null;

export const router = createBrowserRouter(crearRutas(), {
  // Se llama con las rutas que no coinciden (o que solo coinciden con "*"). El panel se agrega
  // una vez: su ruta tiene id fijo, así que volver a parchearla no la duplica.
  async patchRoutesOnNavigation({ patch }) {
    rutasPanel ??= import("./rutasPanel").then((m) => m.rutasPanel);
    patch(ID_RAIZ, await rutasPanel);
  },
});
