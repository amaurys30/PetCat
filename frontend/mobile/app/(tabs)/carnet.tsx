import { IdCard } from "lucide-react-native";

import { useMascotaActual, useMascotas } from "@/features/mascotas/hooks";
import { PestanaVacia } from "@/features/pestanas/PestanaVacia";

export default function Carnet() {
  const mascotas = useMascotas();
  const { actual } = useMascotaActual(mascotas.data);
  const de = actual ? `de ${actual.nombre}` : "de tus mascotas";
  return (
    <PestanaVacia
      titulo="Carnet"
      icono={IdCard}
      mensaje={`Aquí estará el Pasaporte PetCat ${de}: vacunas y desparasitaciones.`}
      fase="M3"
    />
  );
}
