/**
 * Rutas del panel (acceso, selector de negocio, /n/:idNegocio/..., administración). No se
 * importan desde la landing: router.tsx las agrega al router la primera vez que se navega a
 * una ruta que no es pública, así el código del panel se descarga solo al entrar a él.
 */
import { Navigate, type RouteObject } from "react-router";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { ClientesPage } from "@/features/clientes/pages/ClientesPage";
import { ConfiguracionLayout } from "@/features/configuracion/ConfiguracionLayout";
import { PerfilNegocioPage } from "@/features/configuracion/pages/PerfilNegocioPage";
import { ResumenNegocioPage } from "@/features/configuracion/pages/ResumenNegocioPage";
import { SedesPage } from "@/features/configuracion/pages/SedesPage";
import { EquipoLayout } from "@/features/equipo/EquipoLayout";
import { DisponibilidadPage } from "@/features/equipo/pages/DisponibilidadPage";
import { MiembrosPage } from "@/features/equipo/pages/MiembrosPage";
import { MiPerfilPage } from "@/features/perfil/pages/MiPerfilPage";
import { NotificacionesPage } from "@/features/notificaciones/pages/NotificacionesPage";
import { ResenasPage } from "@/features/resenas/pages/ResenasPage";
import { ServicioFormPage } from "@/features/servicios/pages/ServicioFormPage";
import { ServiciosPage } from "@/features/servicios/pages/ServiciosPage";
import { SuscripcionPage } from "@/features/suscripcion/pages/SuscripcionPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { PasswordNuevaPage } from "@/features/auth/pages/PasswordNuevaPage";
import { RecuperarPasswordPage } from "@/features/auth/pages/RecuperarPasswordPage";
import { RegistroPage } from "@/features/auth/pages/RegistroPage";
import { VerificarEmailPage } from "@/features/auth/pages/VerificarEmailPage";
import { AceptarInvitacionPage } from "@/features/invitaciones/pages/AceptarInvitacionPage";
import { AsistenteNegocioPage } from "@/features/negocios/pages/AsistenteNegocioPage";
import { CrearNegocioPage } from "@/features/negocios/pages/CrearNegocioPage";
import { SeleccionarNegocioPage } from "@/features/negocios/pages/SeleccionarNegocioPage";
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
          { path: "restablecer-password/:token", element: <PasswordNuevaPage modo="restablecer" /> },
          { path: "crear-password/:token", element: <PasswordNuevaPage modo="crear" /> },
          // Con o sin sesión: el enlace del correo se puede abrir en cualquier navegador.
          { path: "verificar-email/:token", element: <VerificarEmailPage /> },
          // Con o sin sesión: si hay otra cuenta abierta, al aceptar se reemplaza.
          { path: "invitacion/:token", element: <AceptarInvitacionPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: "negocios", element: <SeleccionarNegocioPage /> },
              { path: "negocios/nuevo", element: <CrearNegocioPage /> },
              { path: "negocios/:idNegocio/configurar", element: <AsistenteNegocioPage /> },
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
                  { path: "resumen", element: <ResumenNegocioPage /> },
                  { path: "perfil", element: <PerfilNegocioPage /> },
                  { path: "sedes", element: <SedesPage /> },
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
                      { path: "miembros", element: <MiembrosPage /> },
                      { path: "roles", lazy: roles },
                    ],
                  },
                  {
                    path: ":idEmpleado/disponibilidad",
                    element: <DisponibilidadPage />,
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
                  { index: true, element: <ServiciosPage /> },
                  { path: "nuevo", element: <ServicioFormPage /> },
                  { path: ":idServicio", element: <ServicioFormPage /> },
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
                  { index: true, element: <ClientesPage /> },
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
                element: <NotificacionesPage />,
                handle: { titulo: "Notificaciones" } satisfies HandleRuta,
              },
              {
                path: "resenas",
                element: <ResenasPage />,
                handle: { titulo: "Reseñas" } satisfies HandleRuta,
              },
              {
                path: "suscripcion",
                element: <SuscripcionPage />,
                handle: { titulo: "Suscripción" } satisfies HandleRuta,
              },
              {
                path: "mi-perfil",
                element: <MiPerfilPage />,
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

