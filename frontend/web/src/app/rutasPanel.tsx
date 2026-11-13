/**
 * Rutas del panel (acceso, selector de negocio, /n/:idNegocio/..., administración). No se
 * importan desde la landing: router.tsx las agrega al router la primera vez que se navega a
 * una ruta que no es pública, así el código del panel se descarga solo al entrar a él.
 */
import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { ConfiguracionLayout } from "@/features/configuracion/ConfiguracionLayout";
import { EquipoLayout } from "@/features/equipo/EquipoLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RecuperarPasswordPage } from "@/features/auth/pages/RecuperarPasswordPage";
import { RegistroPage } from "@/features/auth/pages/RegistroPage";
import { Inicio, RequireAuth, SoloAnonimo } from "./guards";
import { AuthLayout } from "./layouts/AuthLayout";
import { PanelLayout, PrimeraSeccion } from "./layouts/PanelLayout";
import { Raiz } from "./layouts/Raiz";
import type { HandleRuta } from "./layouts/Topbar";
import { SECCIONES } from "./menu";
import { PaginaNoEncontrada } from "./pages/PaginasGenerales";
import { SeccionPendiente } from "./pages/SeccionPendiente";

/** Id de la ruta que envuelve el panel: volver a parchearla no la duplica. */
export const ID_PANEL = "panel";

/**
 * Las páginas se descargan al entrar a su ruta (un archivo cada una). En este módulo quedan
 * los layouts, los guardas y las páginas de acceso (login, registro, recuperar): son la
 * entrada habitual y separarlas sumaría otra espera antes de entrar.
 */
const pagina =
  <M extends Record<string, unknown>>(cargar: () => Promise<M>, nombre: keyof M & string) =>
  async () => ({ Component: (await cargar())[nombre] as ComponentType });

const passwordNueva = (modo: "restablecer" | "crear") => async () => {
  const { PasswordNuevaPage } = await import("@/features/auth/pages/PasswordNuevaPage");
  return { Component: () => <PasswordNuevaPage modo={modo} /> };
};

/**
 * Pantallas pesadas (calendario, gráficos, la ficha con su historial, la matriz de roles y la
 * administración) en archivos aparte: se descargan al entrar a su ruta, no con el panel.
 */
const agenda = async () => ({ Component: (await import("@/features/agenda/pages/AgendaPage")).AgendaPage });
const dashboard = async () => ({
  Component: (await import("@/features/dashboard/pages/DashboardPage")).DashboardPage,
});
const fichaMascota = async () => ({
  Component: (await import("@/features/salud/pages/FichaMascotaPage")).FichaMascotaPage,
});
const roles = async () => ({ Component: (await import("@/features/equipo/pages/RolesPage")).RolesPage });
const adminNegocios = async () => ({
  Component: (await import("@/features/admin/pages/AdminNegociosPage")).AdminNegociosPage,
});

const rutasDesarrollo: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "dev/estados",
        lazy: async () => ({ Component: (await import("./pages/EstadosDemoPage")).EstadosDemoPage }),
      },
    ]
  : [];

export const rutasPanel: RouteObject[] = [
  {
    id: ID_PANEL,
    element: <Raiz />,
    children: [
      // Entrada al panel ("Ir al panel" de la landing y los enlaces de los correos).
      { path: "panel", element: <Inicio /> },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <SoloAnonimo />,
            children: [
              { path: "login", element: <LoginPage /> },
              { path: "recuperar-password", element: <RecuperarPasswordPage /> },
              { path: "registro", element: <RegistroPage /> },
            ],
          },
          { path: "restablecer-password/:token", lazy: passwordNueva("restablecer") },
          { path: "crear-password/:token", lazy: passwordNueva("crear") },
          // Con o sin sesión: el enlace del correo se puede abrir en cualquier navegador.
          {
            path: "verificar-email/:token",
            lazy: pagina(() => import("@/features/auth/pages/VerificarEmailPage"), "VerificarEmailPage"),
          },
          // Con o sin sesión: si hay otra cuenta abierta, al aceptar se reemplaza.
          {
            path: "invitacion/:token",
            lazy: pagina(
              () => import("@/features/invitaciones/pages/AceptarInvitacionPage"),
              "AceptarInvitacionPage",
            ),
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: "negocios",
                lazy: pagina(
                  () => import("@/features/negocios/pages/SeleccionarNegocioPage"),
                  "SeleccionarNegocioPage",
                ),
              },
              {
                path: "negocios/nuevo",
                lazy: pagina(() => import("@/features/negocios/pages/CrearNegocioPage"), "CrearNegocioPage"),
              },
              {
                path: "negocios/:idNegocio/configurar",
                lazy: pagina(
                  () => import("@/features/negocios/pages/AsistenteNegocioPage"),
                  "AsistenteNegocioPage",
                ),
              },
            ],
          },
          {
            // Solo el super admin; para los demás, "No encontrado".
            path: "admin",
            element: <AdminLayout />,
            children: [{ index: true, lazy: adminNegocios }],
          },
          {
            path: "n/:idNegocio",
            element: <PanelLayout />,
            children: [
              { index: true, element: <PrimeraSeccion /> },
              {
                path: "configuracion",
                element: <ConfiguracionLayout />,
                handle: { titulo: "Configuración" } satisfies HandleRuta,
                children: [
                  { index: true, element: <Navigate to="resumen" replace /> },
                  {
                    path: "resumen",
                    lazy: pagina(
                      () => import("@/features/configuracion/pages/ResumenNegocioPage"),
                      "ResumenNegocioPage",
                    ),
                  },
                  {
                    path: "perfil",
                    lazy: pagina(
                      () => import("@/features/configuracion/pages/PerfilNegocioPage"),
                      "PerfilNegocioPage",
                    ),
                  },
                  {
                    path: "sedes",
                    lazy: pagina(() => import("@/features/configuracion/pages/SedesPage"), "SedesPage"),
                  },
                  { path: "*", element: <Navigate to="resumen" replace /> },
                ],
              },
              {
                path: "equipo",
                handle: { titulo: "Equipo" } satisfies HandleRuta,
                children: [
                  {
                    element: <EquipoLayout />,
                    children: [
                      { index: true, element: <Navigate to="miembros" replace /> },
                      {
                        path: "miembros",
                        lazy: pagina(() => import("@/features/equipo/pages/MiembrosPage"), "MiembrosPage"),
                      },
                      { path: "roles", lazy: roles },
                    ],
                  },
                  {
                    path: ":idEmpleado/disponibilidad",
                    lazy: pagina(
                      () => import("@/features/equipo/pages/DisponibilidadPage"),
                      "DisponibilidadPage",
                    ),
                    // El profesional sin Equipo en el menú llega desde Mi perfil.
                    handle: { titulo: "Disponibilidad" } satisfies HandleRuta,
                  },
                  { path: "*", element: <Navigate to="miembros" replace /> },
                ],
              },
              {
                path: "servicios",
                handle: { titulo: "Servicios" } satisfies HandleRuta,
                children: [
                  {
                    index: true,
                    lazy: pagina(() => import("@/features/servicios/pages/ServiciosPage"), "ServiciosPage"),
                  },
                  {
                    path: "nuevo",
                    lazy: pagina(
                      () => import("@/features/servicios/pages/ServicioFormPage"),
                      "ServicioFormPage",
                    ),
                  },
                  {
                    path: ":idServicio",
                    lazy: pagina(
                      () => import("@/features/servicios/pages/ServicioFormPage"),
                      "ServicioFormPage",
                    ),
                  },
                ],
              },
              {
                path: "dashboard",
                lazy: dashboard,
                handle: { titulo: "Dashboard" } satisfies HandleRuta,
              },
              {
                path: "agenda",
                lazy: agenda,
                handle: { titulo: "Agenda" } satisfies HandleRuta,
              },
              {
                path: "clientes",
                handle: { titulo: "Clientes" } satisfies HandleRuta,
                children: [
                  {
                    index: true,
                    lazy: pagina(() => import("@/features/clientes/pages/ClientesPage"), "ClientesPage"),
                  },
                  // La ficha también se abre desde la agenda (B4): la ven quienes tienen
                  // historial_medico.ver o vacunas.ver, aunque no tengan Clientes en el menú.
                  {
                    path: "mascotas/:idMascota",
                    lazy: fichaMascota,
                    handle: { titulo: "Ficha de la mascota" } satisfies HandleRuta,
                  },
                ],
              },
              {
                path: "notificaciones",
                lazy: pagina(
                  () => import("@/features/notificaciones/pages/NotificacionesPage"),
                  "NotificacionesPage",
                ),
                handle: { titulo: "Notificaciones" } satisfies HandleRuta,
              },
              {
                path: "resenas",
                lazy: pagina(() => import("@/features/resenas/pages/ResenasPage"), "ResenasPage"),
                handle: { titulo: "Reseñas" } satisfies HandleRuta,
              },
              {
                path: "suscripcion",
                lazy: pagina(() => import("@/features/suscripcion/pages/SuscripcionPage"), "SuscripcionPage"),
                handle: { titulo: "Suscripción" } satisfies HandleRuta,
              },
              {
                path: "mi-perfil",
                lazy: pagina(() => import("@/features/perfil/pages/MiPerfilPage"), "MiPerfilPage"),
                handle: { titulo: "Mi perfil" } satisfies HandleRuta,
              },
              ...SECCIONES.filter(
                (s) =>
                  ![
                    "agenda",
                    "clientes",
                    "configuracion",
                    "dashboard",
                    "equipo",
                    "resenas",
                    "servicios",
                    "suscripcion",
                  ].includes(s.ruta),
              ).map((seccion): RouteObject => ({
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
    ],
  },
];
