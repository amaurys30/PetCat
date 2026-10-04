import { Link, useNavigate } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { aplicarErroresApi, sinVacios } from "@/lib/forms";
import { useAuth } from "@/stores/auth";
import { FormDatosNegocio } from "../components/FormDatosNegocio";
import { PasosAsistente } from "../components/PasosAsistente";
import { useCrearNegocio } from "../hooks/useGestion";
import { CAMPOS_DATOS_NEGOCIO } from "../schemas";

/**
 * A6 paso 1 (`/negocios/nuevo`): crea el negocio al continuar, así el avance queda en la
 * API y se puede retomar desde cualquier dispositivo. Reemplaza la ruta por la del
 * asistente: "atrás" en el navegador no lo vuelve a crear.
 */
export function CrearNegocioPage() {
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const crear = useCrearNegocio();

  return (
    <AuthCard className="w-[460px]">
      <AuthTitulo titulo="Crea tu negocio" />
      <PasosAsistente actual="negocio" />
      <FormDatosNegocio
        mostrarPlan
        iniciales={{
          nombre: "",
          tipo: "veterinaria",
          telefono: usuario?.telefono ?? "",
          email: usuario?.email ?? "",
          nit: "",
          ciudad: "Sincelejo",
        }}
        enviando={crear.isPending}
        error={crear.error}
        onEnviar={(valores, setError) =>
          crear.mutate(
            { ...sinVacios(valores), nombre: valores.nombre, tipo: valores.tipo },
            {
              onSuccess: (negocio) =>
                navigate(`/negocios/${negocio.id_negocio}/configurar`, { replace: true }),
              onError: (e) => aplicarErroresApi(setError, e, CAMPOS_DATOS_NEGOCIO),
            },
          )
        }
        secundario={
          <Button asChild variant="secondary">
            <Link to="/negocios">Cancelar</Link>
          </Button>
        }
      />
    </AuthCard>
  );
}
