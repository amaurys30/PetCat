import { House } from "lucide-react-native";

import { PestanaVacia } from "@/features/pestanas/PestanaVacia";

export default function Inicio() {
  return (
    <PestanaVacia
      titulo="Inicio"
      icono={House}
      mensaje="Aquí verás a tu mascota, su próxima cita y sus recordatorios."
      fase="M2"
    />
  );
}
