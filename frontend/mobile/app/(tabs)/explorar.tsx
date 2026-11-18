import { Compass } from "lucide-react-native";

import { PestanaVacia } from "@/features/pestanas/PestanaVacia";

export default function Explorar() {
  return (
    <PestanaVacia
      titulo="Explorar"
      icono={Compass}
      mensaje="Aquí encontrarás veterinarias, peluquerías y tiendas cerca de ti."
      fase="M4"
    />
  );
}
