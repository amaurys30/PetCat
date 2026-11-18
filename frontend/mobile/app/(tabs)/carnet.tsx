import { IdCard } from "lucide-react-native";

import { PestanaVacia } from "@/features/pestanas/PestanaVacia";

export default function Carnet() {
  return (
    <PestanaVacia
      titulo="Carnet"
      icono={IdCard}
      mensaje="Aquí estará el Pasaporte PetCat: vacunas y desparasitaciones de tus mascotas."
      fase="M3"
    />
  );
}
