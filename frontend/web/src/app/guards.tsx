import { Navigate, Outlet, useLocation } from "react-router";
import { PoliticaDialog } from "@/features/auth/components/PoliticaDialog";
import { useAuth } from "@/stores/auth";
import { destinoInicial } from "./destino";

/** Rutas con sesión. Sin sesión, al login (recordando a dónde iba). Encima, la política de datos (A9). */
export function RequireAuth() {
  const estado = useAuth((s) => s.estado);
  const salida = useAuth((s) => s.salida);
  const location = useLocation();

  if (estado !== "autenticado") {
    const destino = salida === "expirada" ? "/login?sesion=expirada" : "/login";
    return <Navigate to={destino} replace state={{ desde: { pathname: location.pathname } }} />;
  }
  return (
    <>
      <Outlet />
      <PoliticaDialog />
    </>
  );
}

/** Login y recuperación: con sesión iniciada no tienen sentido, se va al panel. */
export function SoloAnonimo() {
  const usuario = useAuth((s) => s.usuario);
  const location = useLocation();
  if (usuario) {
    const desde = (location.state as { desde?: { pathname: string } } | null)?.desde?.pathname;
    return <Navigate to={destinoInicial(usuario, desde)} replace />;
  }
  return <Outlet />;
}

/** "/" lleva al panel o al login. */
export function Inicio() {
  const usuario = useAuth((s) => s.usuario);
  return <Navigate to={usuario ? destinoInicial(usuario) : "/login"} replace />;
}
