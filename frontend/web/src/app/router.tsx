import { createBrowserRouter, type RouteObject } from "react-router";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { PasswordNuevaPage } from "@/features/auth/pages/PasswordNuevaPage";
import { RecuperarPasswordPage } from "@/features/auth/pages/RecuperarPasswordPage";
import { SeleccionarNegocioPage } from "@/features/negocios/pages/SeleccionarNegocioPage";
import { Inicio, RequireAuth, SoloAnonimo } from "./guards";
import { AuthLayout } from "./layouts/AuthLayout";
import { PanelLayout, PrimeraSeccion } from "./layouts/PanelLayout";
import { Raiz } from "./layouts/Raiz";
import type { HandleRuta } from "./layouts/Topbar";
import { SECCIONES } from "./menu";
import { AccesoPendiente, ErrorDeRuta, PaginaNoEncontrada } from "./pages/PaginasGenerales";
import { SeccionPendiente } from "./pages/SeccionPendiente";

const rutasDesarrollo: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "dev/estados",
        lazy: async () => ({ Component: (await import("./pages/EstadosDemoPage")).EstadosDemoPage }),
      },
    ]
  : [];

export const rutas: RouteObject[] = [
  {
    element: <Raiz />,
    errorElement: <ErrorDeRuta />,
    children: [
      { index: true, element: <Inicio /> },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <SoloAnonimo />,
            children: [
              { path: "login", element: <LoginPage /> },
              { path: "recuperar-password", element: <RecuperarPasswordPage /> },
              { path: "registro", element: <AccesoPendiente titulo="Crear cuenta" fase="P1" /> },
            ],
          },
          { path: "restablecer-password/:token", element: <PasswordNuevaPage modo="restablecer" /> },
          { path: "crear-password/:token", element: <PasswordNuevaPage modo="crear" /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: "negocios", element: <SeleccionarNegocioPage /> },
              { path: "negocios/nuevo", element: <AccesoPendiente titulo="Crear negocio" fase="P1" /> },
            ],
          },
          {
            path: "n/:idNegocio",
            element: <PanelLayout />,
            children: [
              { index: true, element: <PrimeraSeccion /> },
              ...SECCIONES.map((seccion): RouteObject => ({
                path: `${seccion.ruta}/*`,
                element: <SeccionPendiente seccion={seccion} />,
                handle: { titulo: seccion.titulo } satisfies HandleRuta,
              })),
              { path: "*", element: <PaginaNoEncontrada /> },
            ],
          },
        ],
      },
      ...rutasDesarrollo,
      { path: "*", element: <PaginaNoEncontrada /> },
    ],
  },
];

export const router = createBrowserRouter(rutas);
