import { Construction } from "lucide-react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { EstadoPantalla, NoEncontrado } from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";

export function PaginaNoEncontrada() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <NoEncontrado
        acciones={
          <Button asChild variant="secondary">
            <Link to="/">Volver</Link>
          </Button>
        }
      />
    </div>
  );
}

/** Error inesperado al pintar una ruta (fallo de programación). */
export function ErrorDeRuta() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <PaginaNoEncontrada />;
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <EstadoPantalla
        icono={Construction}
        tono="danger"
        titulo="Algo salió mal"
        descripcion="Ocurrió un error inesperado en esta pantalla. Recarga la página para continuar."
        acciones={<Button onClick={() => window.location.reload()}>Recargar</Button>}
      />
    </div>
  );
}
