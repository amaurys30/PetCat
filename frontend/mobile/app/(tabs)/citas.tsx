import { CalendarDays } from "lucide-react-native";

import { PestanaVacia } from "@/features/pestanas/PestanaVacia";

export default function Citas() {
  return (
    <PestanaVacia
      titulo="Citas"
      icono={CalendarDays}
      mensaje="Aquí verás tus citas próximas y pasadas, y podrás reprogramarlas."
      fase="M5"
    />
  );
}
